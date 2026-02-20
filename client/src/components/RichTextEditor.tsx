import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import LinkExtension from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Mic,
  MicOff,
  Link as LinkIcon,
  Unlink,
  Image as ImageIcon,
} from "lucide-react";
import { useEffect, useRef, useMemo } from "react";
import useSpeechRecognition from "../hooks/useSpeechRecognition";

type RichTextEditorProps = {
  content: string;
  isEditing: boolean;
  startListeningOnMount?: boolean;
  onImageUpload?: (file: File) => Promise<string | null>;
  onChange: (html: string) => void;
  onBlur: () => void;
};

const MenuBar = ({
  editor,
  isListening,
  onToggleVoice,
  onImageUpload,
  hasVoiceSupport,
}: {
  editor: any;
  isListening: boolean;
  onToggleVoice: () => void;
  onImageUpload?: (file: File) => Promise<string | null>;
  hasVoiceSupport: boolean;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!editor) {
    return null;
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageUpload) {
      const url = await onImageUpload(file);
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    }
    // Återställ input
    e.target.value = "";
  };

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

      <div style={{ width: 1, background: "#444", margin: "0 4px" }} />

      <button
        onClick={() => {
          const previousUrl = editor.getAttributes("link").href;
          const url = window.prompt("URL", previousUrl);
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
          }
          editor
            .chain()
            .focus()
            .extendMarkRange("link")
            .setLink({ href: url })
            .run();
        }}
        style={buttonStyle(editor.isActive("link"))}
        title="Länk"
      >
        <LinkIcon size={14} />
      </button>
      <button
        onClick={() => editor.chain().focus().unsetLink().run()}
        disabled={!editor.isActive("link")}
        style={{
          ...buttonStyle(false),
          opacity: editor.isActive("link") ? 1 : 0.5,
          cursor: editor.isActive("link") ? "pointer" : "default",
        }}
        title="Ta bort länk"
      >
        <Unlink size={14} />
      </button>

      {onImageUpload && (
        <>
          <div style={{ width: 1, background: "#444", margin: "0 4px" }} />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={buttonStyle(false)}
            title="Infoga bild"
          >
            <ImageIcon size={14} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept="image/*"
            onChange={handleFileSelect}
          />
        </>
      )}

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
  onImageUpload,
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

  // 🔥 FIX: Använd useMemo för extensions för att undvika "Duplicate extension" varningar
  const extensions = useMemo(
    () => [
      // @ts-ignore - Vi tvingar bort 'link' från StarterKit ifall det skulle finnas där
      StarterKit.configure({ link: false }),
      Placeholder.configure({
        placeholder: "Skriv något...",
      }),
      LinkExtension.configure({
        openOnClick: true, // Öppna länkar vid klick (viktigt för view-mode)
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: {
          target: "_blank", // Öppna i ny flik så man inte tappar bort sin board
          rel: "noopener noreferrer",
        },
      }),
      ImageExtension.configure({
        inline: false,
      }),
    ],
    [],
  );

  const editor = useEditor({
    extensions: extensions,
    content: content,
    editable: isEditing,
    autofocus: isEditing ? "end" : false, // 🔥 FIX: Säkerställ att vi får fokus direkt vid mount
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
        } tiptap`, // 🔥 FIX: Lägg till 'tiptap' klassen så NoteNode kan hitta och mäta den
        style: "min-height: 60px; outline: none;",
      },
    },
  });

  // Auto-starta lyssning om flaggan är satt (t.ex. från Radial Menu)
  useEffect(() => {
    if (startListeningOnMount) {
      startListening();
    }
  }, [startListeningOnMount, startListening]);

  // Stäng av mikrofonen automatiskt när edit-läget avslutas (t.ex. vid onBlur)
  useEffect(() => {
    if (!isEditing && isListening) {
      stopListening();
    }
  }, [isEditing, isListening, stopListening]);

  // Lyssna på inkommande text från Web Speech API
  const lastProcessedText = useRef(""); // 🔥 Skydd mot dubbletter

  useEffect(() => {
    if (transcript && editor && transcript !== lastProcessedText.current) {
      console.log("📝 Infogar text i editor:", transcript);
      // Infoga texten vid markören och lägg till ett mellanslag
      editor.chain().focus().insertContent(`${transcript} `).run();

      lastProcessedText.current = transcript;
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
      editor.commands.setContent(content);
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
            } tiptap`, // 🔥 FIX: Lägg till 'tiptap' här också
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
      className="rich-text-editor-wrapper" // 🔥 FIX: Klass för att kunna mäta höjden inklusive meny
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "auto",
        minHeight: "auto", // 🔥 FIX: Låt innehållet styra, tvinga inte 100%
        flexShrink: 0,
      }}
    >
      {isEditing && (
        <MenuBar
          editor={editor}
          isListening={isListening}
          onToggleVoice={isListening ? stopListening : startListening}
          onImageUpload={onImageUpload}
          hasVoiceSupport={hasSupport}
        />
      )}
      <EditorContent
        editor={editor}
        style={{
          width: "100%",
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
        .tiptap a { color: #6366f1; text-decoration: underline; cursor: pointer; }
        .tiptap img { max-width: 100%; border-radius: 8px; margin: 8px 0; display: block; }
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
