import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Mic,
  MicOff,
} from "lucide-react";
import { useEffect, useRef } from "react";
import useSpeechRecognition from "../hooks/useSpeechRecognition";

type RichTextEditorProps = {
  content: string;
  isEditing: boolean;
  startListeningOnMount?: boolean;
  onChange: (html: string) => void;
  onBlur: () => void;
};

const MenuBar = ({
  editor,
  isListening,
  onToggleVoice,
  hasVoiceSupport,
}: {
  editor: any;
  isListening: boolean;
  onToggleVoice: () => void;
  hasVoiceSupport: boolean;
}) => {
  if (!editor) {
    return null;
  }

  const buttonStyle = (isActive: boolean) => ({
    background: isActive ? "#6366f1" : "transparent",
    color: isActive ? "#fff" : "#ccc",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    padding: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  });

  return (
    <div
      className="nodrag" // VIKTIGT: Gör att man kan klicka på knappar utan att dra noden
      onMouseDown={(e) => e.preventDefault()} // 🔥 FIX: Förhindra att editorn tappar fokus när man klickar på menyn
      style={{
        display: "flex",
        gap: "4px",
        marginBottom: "8px",
        padding: "4px",
        background: "#222",
        borderRadius: "6px",
        flexWrap: "wrap",
      }}
    >
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        style={buttonStyle(editor.isActive("bold"))}
        title="Fetstil"
      >
        <Bold size={14} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        style={buttonStyle(editor.isActive("italic"))}
        title="Kursiv"
      >
        <Italic size={14} />
      </button>
      <div style={{ width: 1, background: "#444", margin: "0 4px" }} />
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        style={buttonStyle(editor.isActive("heading", { level: 1 }))}
        title="Rubrik 1"
      >
        <Heading1 size={14} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        style={buttonStyle(editor.isActive("heading", { level: 2 }))}
        title="Rubrik 2"
      >
        <Heading2 size={14} />
      </button>
      <div style={{ width: 1, background: "#444", margin: "0 4px" }} />
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        style={buttonStyle(editor.isActive("bulletList"))}
        title="Punktlista"
      >
        <List size={14} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        style={buttonStyle(editor.isActive("orderedList"))}
        title="Numrerad lista"
      >
        <ListOrdered size={14} />
      </button>

      {hasVoiceSupport && (
        <>
          <div style={{ width: 1, background: "#444", margin: "0 4px" }} />
          <button
            onClick={(e) => {
              // Stoppa eventuella bubblande events som kan störa
              e.stopPropagation();
              console.log("Mic clicked. Listening:", isListening);
              onToggleVoice();
            }}
            style={{
              ...buttonStyle(isListening),
              color: isListening ? "#ff4444" : "#ccc",
            }}
            title={isListening ? "Sluta lyssna" : "Diktera"}
          >
            {isListening ? <Mic size={14} /> : <MicOff size={14} />}
          </button>
        </>
      )}
    </div>
  );
};

export default function RichTextEditor({
  content,
  isEditing,
  startListeningOnMount,
  onChange,
  onBlur,
}: RichTextEditorProps) {
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    hasSupport,
  } = useSpeechRecognition();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Skriv något...",
      }),
    ],
    content: content,
    editable: isEditing,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onBlur: () => {
      onBlur();
    },
    editorProps: {
      attributes: {
        // VIKTIGT: 'nodrag' läggs till villkorligt. Utan den kan vi dra noden via texten.
        class: `prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none text-white ${
          isEditing ? "nodrag" : ""
        }`,
        style: "min-height: 60px; outline: none;",
      },
    },
  });

  // Auto-starta lyssning om flaggan är satt (t.ex. från Radial Menu)
  const hasAutoStartedRef = useRef(false);
  useEffect(() => {
    if (startListeningOnMount && !hasAutoStartedRef.current) {
      startListening();
      hasAutoStartedRef.current = true;
    }
  }, [startListeningOnMount, startListening]);

  // Stäng av mikrofonen automatiskt när edit-läget avslutas (t.ex. vid onBlur)
  useEffect(() => {
    if (!isEditing && isListening) {
      stopListening();
    }
  }, [isEditing, isListening, stopListening]);

  // Lyssna på inkommande text från Web Speech API
  useEffect(() => {
    if (transcript && editor) {
      console.log("📝 Infogar text i editor:", transcript);
      // Infoga texten vid markören och lägg till ett mellanslag
      editor.chain().focus().insertContent(`${transcript} `).run();
      // Rensa transcript i hooken så vi inte infogar samma text igen
      resetTranscript();
    }
  }, [transcript, editor, resetTranscript]);

  // Synka content om det ändras utifrån (t.ex. vid undo/redo)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      // Jämför för att undvika loopar/cursor jump
      // En enkel koll, för mer avancerad diffing kan man behöva mer logik
      if (editor.getText() === "" && content === "") return;
      // Vi sätter bara content om skillnaden är signifikant eller vid init
      // För en enkel implementation litar vi på Tiptaps content management
    }
  }, [content, editor]);

  // Hantera edit-läge
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing);

      // Uppdatera klasser dynamiskt: Lägg till 'nodrag' endast i edit-mode
      editor.setOptions({
        editorProps: {
          attributes: {
            class: `prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none text-white ${
              isEditing ? "nodrag" : ""
            }`,
            style: "min-height: 60px; outline: none;",
          },
        },
      });

      if (isEditing) {
        editor.commands.focus();
      }
    }
  }, [isEditing, editor]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
      }}
    >
      {isEditing && (
        <MenuBar
          editor={editor}
          isListening={isListening}
          onToggleVoice={isListening ? stopListening : startListening}
          hasVoiceSupport={hasSupport}
        />
      )}
      <EditorContent
        editor={editor}
        style={{
          flex: 1,
          cursor: isEditing ? "text" : "default",
          // Enkel styling för HTML-innehållet
          fontSize: "14px",
          lineHeight: "1.5",
        }}
        className="tiptap-container"
      />
      <style>{`
        .tiptap p { margin: 0 0 8px 0; }
        .tiptap ul, .tiptap ol { padding-left: 20px; margin: 4px 0; }
        .tiptap ul { list-style-type: disc; }
        .tiptap ol { list-style-type: decimal; }
        .tiptap h1 { font-size: 1.4em; font-weight: bold; margin-bottom: 8px; }
        .tiptap h2 { font-size: 1.2em; font-weight: bold; margin-bottom: 6px; }
        .tiptap-container .is-editor-empty:first-child::before {
          color: #ccc;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
