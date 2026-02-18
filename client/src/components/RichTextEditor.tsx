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
} from "lucide-react";
import { useEffect } from "react";

type RichTextEditorProps = {
  content: string;
  isEditing: boolean;
  onChange: (html: string) => void;
  onBlur: () => void;
};

const MenuBar = ({ editor }: { editor: any }) => {
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
    </div>
  );
};

export default function RichTextEditor({
  content,
  isEditing,
  onChange,
  onBlur,
}: RichTextEditorProps) {
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
        // VIKTIGT: 'nodrag' gör att vi kan markera text utan att React Flow flyttar noden
        class:
          "nodrag prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none text-white",
        style: "min-height: 60px; outline: none;",
      },
    },
  });

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
      {isEditing && <MenuBar editor={editor} />}
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
          color: #666;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
