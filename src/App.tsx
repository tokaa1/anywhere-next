import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { memo, useEffect, useRef, useState } from 'react'
import { Context, LLMMessage, ModelMetadata, Provider, createOllamaProvider } from './providers';
import Markdown, { Components } from 'react-markdown';
import {Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, xonokai } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';

const isMac = navigator.userAgent.toLowerCase().includes('macintosh') || navigator.userAgent.toLowerCase().includes('apple');
interface AvailableModel {
  model: ModelMetadata;
  provider: Provider;
}
type ChatIdentifier = string;
const createNewChatId = () => crypto.randomUUID();
interface ChatData {
  context: Context;
  lastUpdated: Date;
  name: string;
}
const getChatData = (chatId: ChatIdentifier): ChatData => {
  const chatData = localStorage.getItem('chat-' + chatId);
  if (!chatData)
    return { context: [], lastUpdated: new Date(), name: 'New chat' };
  const parsedData = JSON.parse(chatData);
  if (parsedData.name === undefined)
    parsedData.name = 'Unnamed chat';
  return parsedData;
}
const setChatData = (chatId: ChatIdentifier, chatData: Partial<ChatData>) => {
  localStorage.setItem('chat-' + chatId, JSON.stringify({ ...getChatData(chatId), ...chatData }));
}
const getChatList = (): ChatIdentifier[] => {
  const chatList = localStorage.getItem('chat-list');
  if (!chatList)
    return [];
  return JSON.parse(chatList);
}
const appendChatList = (chatId: ChatIdentifier) => {
  const chatList = getChatList();
  // Remove if exists (to reposition to front)
  const filteredList = chatList.filter(id => id !== chatId);
  // Add to front of list
  filteredList.unshift(chatId);
  localStorage.setItem('chat-list', JSON.stringify(filteredList));
}

type Pages = 'chat' | 'history' | 'settings';
const pageAtom = atom<Pages>('chat');
const isGeneratingAtom = atom<boolean>(false);
const availableModelsAtom = atom<AvailableModel[]>([]);
const currentModelAtom = atom<AvailableModel | null>(null);
const currentChatNameAtom = atom<string>('New chat');
const currentChatAtom = atom<ChatIdentifier>(createNewChatId());

function App() {
  const [page, setPage] = useAtom(pageAtom);
  const [currentChat, setCurrentChat] = useAtom(currentChatAtom);
  const currentChatName = useAtomValue(currentChatNameAtom);
  const [availableModels, setAvailableModels] = useAtom(availableModelsAtom);
  const [currentModel, setCurrentModel] = useAtom(currentModelAtom);
  
  // Load list of all models
  useEffect(() => {
    const ollamaProvider = createOllamaProvider();
    ollamaProvider.listModels().then((models) => {
      const newAvailableModels = [...availableModels, ...models.map((model) => ({
        model,
        provider: ollamaProvider
      }))];
      newAvailableModels.sort((a, b) => a.model.name.localeCompare(b.model.name));
      setAvailableModels(newAvailableModels);
      setCurrentModel(newAvailableModels[0]);
    });
  }, [setAvailableModels]);

  return <>
    <SplitView className="box-border min-h-[40px] rounded-xl p-[4px] my-[4px] justify-between">
      <div className='flex items-center justify-start gap-2 h-full'>
        <ChatHeaderButton name={currentChatName} onClick={() => {
          if (page === 'chat')
            setCurrentChat(createNewChatId());
          else
            setPage('chat');
        }} />
      </div>
      <div className='flex items-center gap-2'>
        <div className='box-border w-[1px] h-full py-[4px] bg-medium-frost'></div>
        <SmallNavButton bigText
          onClick={() => {
            setPage('chat');
            setCurrentChat(createNewChatId());
          }}
        >
          +
        </SmallNavButton>
        <SmallNavButton onClick={() => setPage('history')}>
          History
        </SmallNavButton>
      </div>
    </SplitView>
    {page === 'chat' && <MemoizedChat key={currentChat} id={currentChat} />}
    {page === 'history' && <History />}
    {page === 'settings' && <></>}
    <SplitView className="h-[40px] flex items-center justify-center">
      <div className="flex items-center gap-4">
        <span className="text-xs font-sans text-white flex items-center gap-[4px]">
          Show/Hide
          <div className="flex items-center gap-1 border-[1px] border-white rounded-md border-solid p-[2px] pr-[3px]">
            <span className="font-sans bg-white text-black px-1.5 py-0.5 rounded">{isMac ? '⌘' : 'Ctrl'}</span>
            <span className="font-sans text-white">D</span>
          </div>
        </span>
      </div>
    </SplitView>
  </>
}
function ChatHeaderButton({ onClick, name }: { onClick?: () => void, name: string }) {
  return <div className={`h-[30px] cursor-pointer overflow-x-auto bg-frosted-bg-tslc-darker hover:bg-frosted-bg border-1 border-solid border-white flex items-center p-[10px] py-0 transition-colors rounded-lg`} onClick={onClick}>
    <span className={`overflow-hidden text-[12px] font-sans text-white m-0 p-0 font-bold`}>{name}</span>
  </div>
}

function SmallNavButton({ children, onClick, bigText = false }: { children: React.ReactNode, onClick?: () => void, bigText?: boolean }) {
  return <div className='cursor-pointer border-hard-frost hover:border-medium-frost border-[1px] border-solid min-w-[16px] h-[22px] px-[8px] items-center justify-center bg-frosted-bg-tslc-darker hover:bg-frosted-bg flex items-center p-[4px] transition-colors rounded-lg' onClick={onClick}>
    <span className={`font-sans ${bigText ? 'text-m' : 'text-xs'} font-semibold text-white`}>
      {children}
    </span>
  </div>
}

function History() {
  const chatList = getChatList();
  const [currentChat, setCurrentChat] = useAtom(currentChatAtom);
  const [page, setPage] = useAtom(pageAtom);
  const onChatClick = (chatId: ChatIdentifier) => {
    setCurrentChat(chatId);
    setPage('chat');
  }
  
  return <div className='flex flex-col box-border gap-[4px] w-full h-full overflow-y-auto p-2'>
    {chatList.map((chatId) => {
      const chatData = getChatData(chatId);
      return <div onClick={() => onChatClick(chatId)} key={chatId} className='cursor-pointer box-border p-[4px] rounded-xl bg-hard-frost-tslc hover:bg-hard-frost-less-tslc w-full text-center font-sans text-white font-light text-[15px] justify-start items-start'>
        <p className='text-left font-bold text-l m-0 p-0'>
          {chatData.name}
        </p>
        <p className='text-left text-m m-0 p-0'>
          {new Date(chatData.lastUpdated).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} {new Date(chatData.lastUpdated).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </p>
      </div>
    })}
  </div>
}

const MemoizedChat = memo(function Chat({ id }: { id: ChatIdentifier }) {
  const setCurrentChatName = useSetAtom(currentChatNameAtom);
  const setIsGenerating = useSetAtom(isGeneratingAtom);
  const [contextState, setContextState] = useState<Context>([]);
  const [currentModel, setCurrentModel] = useAtom(currentModelAtom);

  useEffect(() => {
    const chatData = getChatData(id);
    setCurrentChatName(chatData.name);
    setContextState(chatData.context);
  }, [id]);

  const [editingMessage, setEditingMessage] = useState<number | null>(null);

  const prompt = (text: string, context: Context = contextState) => {
    if (!currentModel)
      return;

    doSummaryTitlePromptAsync(text);
    setIsGenerating(true);
    let newMessages: Context = [
      ...context,
      {
        role: 'user',
        model: currentModel.model.name,
        message: text,
      },
      {
        role: 'assistant',
        model: currentModel.model.name,
        message: ""
      }
    ];
    setContextState(newMessages);
    const assistantIndex = newMessages.length - 1;
    currentModel.provider.generateText(currentModel.model.name, newMessages, (chunk) => {
      newMessages = [...newMessages]
      newMessages[assistantIndex].message += chunk;
      setContextState(newMessages);
    }).then(() => {
      setChatData(id, { context: newMessages });
      appendChatList(id);
    }).finally(() => {
      setIsGenerating(false);
    }).catch((error) => {
      console.error(error);
    })
  }

  const doSummaryTitlePromptAsync = (userText: string) => {
    if (!currentModel)
      return;

    let result = "";
    currentModel.provider.generateText(currentModel.model.name, [
      {
        role: 'system',
        model: currentModel.model.name,
        // System message from vercel/ai-chatbot
        message: `\n
          - you will generate a short title based on the first message a user begins a conversation with
          - ensure it is not more than 25 characters long
          - the title should be a summary of the user's message
          - do not use quotes or colons`,
      },
      {
        role: 'user',
        model: currentModel.model.name,
        message: userText
      }
    ], (chunk) => {
      result += chunk;
    }).then(() => {
      let title = result.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      // Remove surrounding quotes using some crazy ass regex
      title = title.replace(/^["'](.*)["']$/, (match, p1) => {
        const firstChar = match[0];
        const lastChar = match[match.length - 1];
        if ((firstChar === '"' && lastChar === '"') || (firstChar === "'" && lastChar === "'")) {
          return p1;
        }
        return match;
      });
      // Remove any markdown formatting
      title = title.replace(/[*_~`#\[\]]/g, '');
      // Truncate with ... if longer than 25 chars
      if (title.length > 25) {
        title = title.slice(0, 23) + '...';
      }
      setChatData(id, { name: title });
      setCurrentChatName(title);
    })
  }

  return <>
    <div className='w-full h-[1px] bg-medium-frost mb-[8px]'></div>
    <SplitView className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-[12px]" style={{ scrollbarWidth: 'none' }}>
      {
        contextState.map((message, index) => {
          if (message.role === 'user') {
            return editingMessage === index ? (
              <InputContainer
                key={index}
                initialTypedText={message.message}
                placeholderText="Recompose your prompt"
                onEnter={(text) => {
                  if (!currentModel)
                    return false;
                  const newMessages = contextState.slice(0, index);
                  setContextState(newMessages);
                  prompt(text, newMessages);
                  setEditingMessage(null);
                  return true;
                }}
                onTryUnfocused={() => setEditingMessage(null)}
              >
                <button
                  className="cursor-pointer border-[1px] font-bold border-solid border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1 rounded-md transition-colors shadow-[0_2px_4px_rgba(0,0,0,0.2)] flex items-center gap-1 text-[12px]"
                  onClick={() => setEditingMessage(null)}
                >
                  Cancel
                </button>
              </InputContainer>
            ) : (
              <MemoizedUserMessage
                key={index}
                message={message}
                onClick={() => setEditingMessage(index)}
              />
            )
          } else {
            return <AssistantMessageContainer key={index} message={message} />
          }
        })
      }
      {contextState.length == 0 &&
        (() => {
          const hour = new Date().getHours();
          if (hour >= 6 && hour < 12) {
            return <h1 className='font-light text-center text-light-frost text-m font-sans'>Good morning! ☀️</h1>;
          } else if (hour >= 12 && hour < 19) {
            return <h1 className='font-light text-center text-light-frost text-m font-sans'>Good afternoon! 🌤️</h1>;
          } else if (hour >= 19 && hour < 24) {
            return <h1 className='font-light text-center text-light-frost text-m font-sans'>Good evening! 🌙</h1>;
          } else {
            return <h1 className='font-light text-center text-light-frost text-m font-sans'>Good... night? 😴</h1>;
          }
        })()
      }
      {<div className='w-full bg-transparent min-h-[60px]'></div>}
    </SplitView>
    <SplitView className="min-h-[110px]">
      <InputContainer placeholderText="Ask, learn, brainstorm" onEnter={(text) => {
        if (!currentModel)
          return false;
        prompt(text);
        return true;
      }} />
    </SplitView>
  </>
});

const MemoizedUserMessage = memo(function UserMessage({ message, onClick }: { message: LLMMessage, onClick: () => void }) {
  return <div
    className='cursor-text py-[2px] px-[10px] box-border bg-hard-frost-tslc hover:bg-hard-frost-less-tslc w-full min-h-[40px] rounded-lg flex items-center'
    onClick={onClick}
  >
    <span className='text-sm font-sans text-light-frost text-left'>{message.message}</span>
  </div>
});

const MemoizedCopyButton = memo(function CopyButton({ content }: { content: string }) {
  return (
    <button
      className="text-xs ml-[2px] my-[3px] flex font-sans items-center bg-transparent border-none hover:bg-hard-frost-tslc transition-colors rounded-md p-[2px] px-[0px] cursor-pointer animate-pulse"
      onClick={() => {
        navigator.clipboard.writeText(content);
      }}
    >
      {'Copy code '}
      <img src="/src/assets/copy-svgrepo-com.svg" width="16" height="16" alt="Copy" />
    </button>
  );
});


function AssistantMessageContainer({ message }: { message: LLMMessage }) {
  return (
    <div className='flex flex-col items-start p-[5px] text-[14px] select-text text-white'>
      <Markdown
        components={{
          code(props) {
            const {children, className, node, ...rest} = props
            const match = /language-(\w+)/.exec(className || '')
            const content = match ? String(children).replace(/\n$/, '') : String(children);
            return match ? (
              <>
                <div className='w-full h-[12px] py-[6px] text-xs text-white font-sans font-bold'>
                  {match[1]}
                </div>
                <SyntaxHighlighter
                  PreTag="div"
                  children={content}
                  language={match[1]}
                  style={xonokai}
                  useInlineStyles={true}
                  customStyle={{
                    border: 'none',
                    borderRadius: '10px',
                    margin: 0,
                    padding: '8px',
                    boxSizing: 'border-box',
                  }}
                />
                <MemoizedCopyButton content={content} />
              </>
            ) : (
              <code {...rest} className={className}>
                {content}
              </code>
            )
          },
          p: ({children}) => <p className="my-[4px]">{children}</p>,
          h1: ({children}) => <h1 className="my-[4px]">{children}</h1>,
          h2: ({children}) => <h2 className="my-[4px]">{children}</h2>,
          h3: ({children}) => <h3 className="my-[4px]">{children}</h3>,
          h4: ({children}) => <h4 className="my-[4px]">{children}</h4>,
          h5: ({children}) => <h5 className="my-[4px]">{children}</h5>,
          h6: ({children}) => <h6 className="my-[4px]">{children}</h6>,
          ul: ({children}) => <ul className="my-[4px]">{children}</ul>,
          ol: ({children}) => <ol className="my-[4px]">{children}</ol>,
          li: ({children}) => <li className="my-[4px]">{children}</li>,
          blockquote: ({children}) => <blockquote className="my-[4px]">{children}</blockquote>,
          table: ({children}) => <table className="my-[4px]">{children}</table>,
          tr: ({children}) => <tr className="my-[4px]">{children}</tr>,
          th: ({children}) => <th className="my-[4px]">{children}</th>,
          td: ({children}) => <td className="my-[4px]">{children}</td>,
        }}
      >
        {message.message}
      </Markdown>
    </div>
  );
}

function InputContainer({ className, initialTypedText = "", placeholderText, onEnter, onTryUnfocused, small = false, children }: { className?: string, initialTypedText?: string, placeholderText: string, onEnter: (text: string) => boolean, onTryUnfocused?: () => void, small?: boolean, children?: React.ReactNode }) {
  const isGenerating = useAtomValue(isGeneratingAtom);
  const availableModels = useAtomValue(availableModelsAtom);
  const [currentModel, setCurrentModel] = useAtom(currentModelAtom);
  const [typedText, setTypedText] = useState(initialTypedText)
  const containerRef = useRef<HTMLDivElement>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!textAreaRef.current)
      return;

    textAreaRef.current.focus()
    textAreaRef.current.setSelectionRange(textAreaRef.current.value.length, textAreaRef.current.value.length)
  }, []);

  useEffect(() => {
    if (!onTryUnfocused)
      return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onTryUnfocused();
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [typedText, onTryUnfocused])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (typedText.trim() === '' || isGenerating)
        return;

      if (onEnter(typedText))
        setTypedText('')
    }
  }

  return <div ref={containerRef} className={`box-border border-solid border-hard-frost flex w-full p-[10px] rounded-lg shadow-[0_0_10px_var(--frosted-bg-tslc-darker)] border ${className || ''}`}>
    <div className="flex flex-col w-full h-full p-0 m-0 justify-between">
      <textarea
        className={`w-full h-full min-h-[${small ? '20' : '60'}px] max-h-[300px] text-sm bg-transparent border-none outline-none resize-none font-sans placeholder:text-medium-frost overflow-y-auto`}
        placeholder={placeholderText}
        value={typedText}
        onChange={(e) => {
          setTypedText(e.target.value)
          e.target.style.height = 'auto'
          const newHeight = Math.min(e.target.scrollHeight, 300)
          e.target.style.height = newHeight + 'px'
        }}
        onKeyDown={handleKeyDown}
        ref={textAreaRef}
      />
      <div className="flex justify-between items-center mt-2">
        <select
          className="cursor-pointer text-left font-sans font-bold border-none font-medium bg-transparent text-white rounded-md transition-colors text-xs"
          onChange={(e) => {
            setCurrentModel(availableModels.find((model) => model.model.name === e.target.value) || null)
          }}
          value={currentModel?.model.name || ''}
        >
          {availableModels.map((model) => (
            <option key={model.model.name} value={model.model.name}>{model.model.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          {children}
          <button
            className="cursor-pointer font-semibold border-none bg-green-500 hover:bg-green-600 disabled:bg-green-700 text-white px-3 py-1 rounded-md transition-colors shadow-[0_2px_4px_rgba(0,0,0,0.2)] flex items-center gap-1 text-xs font-medium"
            onClick={() => {
              if (onEnter(typedText))
                setTypedText('')
            }}
            disabled={typedText.trim() === '' || isGenerating}
          >
            Send
            <img src="/src/assets/arrow-enter-svgrepo-com.svg" width="12" height="12" alt="Send" />
          </button>
        </div>
      </div>
    </div>
  </div>
}

function SplitView({ children, className, style }: { children: React.ReactNode, className?: string, style?: React.CSSProperties }) {
  return <div className={`w-full flex ${className || ''}`} style={style}>
    {children}
  </div>
}

export default App