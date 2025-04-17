import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { memo, useEffect, useRef, useState } from 'react'
import { Context, LLMMessage, ModelMetadata, Provider, createOllamaProvider } from './providers';
import { Components } from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { xonokai } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import { atomWithStorage } from 'jotai/utils'

const isMac = navigator.userAgent.toLowerCase().includes('macintosh') || navigator.userAgent.toLowerCase().includes('apple');
interface AvailableModel {
  model: ModelMetadata;
  provider: Provider;
}
type ChatIdentifier = string;
const createNewChatId = () => crypto.randomUUID();
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
  const [currentChatName, setCurrentChatName] = useAtom(currentChatNameAtom);

  return <>
    <SplitView className="box-border bg-frosted-accent-tslc min-h-[40px] rounded-xl p-[4px] my-[4px] justify-between">
      <div className='flex items-center justify-start gap-2 h-full'>
        <ChatHeaderButton name={currentChatName} onClick={() => setPage('chat')} />
      </div>
      <div className='flex items-center gap-2'>
        <div className='box-border w-[1px] h-full py-[4px] bg-medium-frost'></div>
        <SmallNavButton bigText>
          +
        </SmallNavButton>
        <SmallNavButton>
          History
        </SmallNavButton>
      </div>
    </SplitView>
    {page === 'chat' && <MemoizedChat key={currentChat} />}
    {page === 'history' && <></>}
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
  if (name.length > 25) {
    name = name.slice(0, 23) + '...';
  }
  // Remove quotes if present
  name = name.replace(/^["'](.*)["']$/, '$1');
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

const MemoizedChat = memo(function Chat() {
  const currentChatName = useSetAtom(currentChatNameAtom);
  const setIsGenerating = useSetAtom(isGeneratingAtom);
  const [contextState, setContextState] = useState<Context>([]);
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
        message: `\n
          - you will generate a short title based on the first message a user begins a conversation with
          - ensure it is not more than 80 characters long
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
      console.log(result);
      currentChatName(result.replace(/<think>[\s\S]*?<\/think>/gi, '').trim());
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
    className='cursor-text py-[2px] px-[10px] box-border bg-hard-frost-tslc w-full min-h-[40px] rounded-lg flex items-center'
    onClick={onClick}
  >
    <span className='text-sm font-sans text-light-frost text-left'>{message.message}</span>
  </div>
});

function AssistantMessageContainer({ message }: { message: LLMMessage }) {
  const components: Components = {
    code({ node, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      return match ? (
        <>
          <SyntaxHighlighter
            style={xonokai}
            language={match[1]}
            customStyle={{
              overflow: 'auto',
              scrollbarWidth: 'thin',
              maxWidth: '100%',
              boxSizing: 'border-box',
              fontSize: '11px',
              borderRadius: '8px',
              backgroundColor: 'var(--frosted-bg-tslc-darker)',
              border: 'none',
              padding: '8px',
              maxHeight: '300px',
              userSelect: 'text'
            }}
            wrapLines={false}
            wrapLongLines={false}
            showLineNumbers={false}
            useInlineStyles={true}
            codeTagProps={{
              className: "code-tag"
            }}
          >
            {children as string | string[]}
          </SyntaxHighlighter>
          <button
            className="text-xs mb-[4px] flex font-sans items-center bg-transparent border-none hover:bg-hard-frost-tslc transition-colors rounded-md p-[2px] px-[6px] cursor-pointer animate-pulse"
            onClick={() => {
              navigator.clipboard.writeText(children as string);
            }}
          >
            {'Copy code '}
            <img src="/src/assets/copy-svgrepo-com.svg" width="16" height="16" alt="Copy" />
          </button>
        </>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    p({ node, className, children, ...props }) {
      return <p className={`${className} font-sans m-0 p-0 select-text`} {...props}>{children}</p>
    },
    pre({ node, className, children, ...props }) {
      return <pre className={`${className} m-0 p-0 max-w-[100%] w-[100%] box-border`} {...props}>{children}</pre>
    },
    ul({ node, className, children, ...props }) {
      return <ul className={`${className} p-[0px] pt-0 my-[6px] pl-[20px]`} {...props}>{children}</ul>
    },
    ol({ node, className, children, ...props }) {
      return <ol className={`${className} p-[0px] pt-0 my-[6px] pl-[20px]`} {...props}>{children}</ol>
    }
  };
  return (
    <div className='flex flex-col items-start p-[5px] text-[14px] select-text text-white'>
      <ReactMarkdown components={components}>{message.message}</ReactMarkdown>
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

  return <div ref={containerRef} className={`box-border flex bg-hard-frost-tslc w-full p-[10px] rounded-lg shadow-[0_0_10px_var(--frosted-bg-tslc-darker)] border ${className || ''}`}>
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
            <option value={model.model.name}>{model.model.name}</option>
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