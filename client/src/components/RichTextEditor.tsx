import {
  useEditor,
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { Mark, mergeAttributes } from "@tiptap/core";
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
  Heading3,
  Mic,
  MicOff,
  Link as LinkIcon,
  Unlink,
  Image as ImageIcon,
  Upload,
  AlignLeft,
  AlignCenter,
  AlignRight,
  X,
} from "lucide-react";
import { useEffect, useRef, useMemo, useState } from "react";
import useSpeechRecognition from "../hooks/useSpeechRecognition";
import ImageUrlModal from "./ImageUrlModal";

// 🔥 Custom Font Size Extension
const FontSize = Mark.create({
  name: "fontSize",

  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: (element) => element.style.fontSize.replace("px", ""),
        renderHTML: (attributes) => {
          if (!attributes.size) {
            return {};
          }
          return {
            style: `font-size: ${attributes.size}px`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        style: "font-size",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ commands }: any) => {
          return commands.setMark(this.name, { size });
        },
      unsetFontSize:
        () =>
        ({ commands }: any) => {
          return commands.unsetMark(this.name);
        },
    } as any;
  },
});

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
  onLinkClick,
  onImageUrlClick,
}: {
  editor: any;
  isListening: boolean;
  onToggleVoice: () => void;
  onImageUpload?: (file: File) => Promise<string | null>;
  hasVoiceSupport: boolean;
  onLinkClick: () => void;
  onImageUrlClick: () => void;
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
      {/* Font Size Dropdown */}
      <select
        className="nodrag"
        onMouseDown={(e) => e.stopPropagation()} // 🔥 VIKTIGT: Låt select ta fokus så den kan öppnas
        onChange={(e) => {
          const size = e.target.value;
          if (size) {
            editor.chain().focus().setFontSize(size).run();
          } else {
            editor.chain().focus().unsetFontSize().run();
          }
        }}
        value={editor.getAttributes("fontSize").size || ""}
        style={{
          background: "transparent",
          color: "#ccc",
          border: "1px solid #444",
          borderRadius: "4px",
          padding: "0 4px",
          fontSize: "12px",
          height: "24px",
          cursor: "pointer",
          outline: "none",
          marginRight: "4px",
        }}
      >
        <option value="" style={{ color: "black" }}>
          Auto
        </option>
        {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72, 96].map(
          (size) => (
            <option key={size} value={size} style={{ color: "black" }}>
              {size}
            </option>
          ),
        )}
      </select>

      <div style={{ width: 1, background: "#444", margin: "0 4px" }} />

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
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        style={buttonStyle(editor.isActive("heading", { level: 3 }))}
        title="Rubrik 3"
      >
        <Heading3 size={14} />
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
        onClick={onLinkClick}
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

      <div style={{ width: 1, background: "#444", margin: "0 4px" }} />

      {/* Knapp för bild via URL */}
      <button
        onClick={onImageUrlClick}
        style={buttonStyle(false)}
        title="Infoga bild från URL"
      >
        <ImageIcon size={14} />
      </button>

      {onImageUpload && (
        <>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={buttonStyle(false)}
            title="Ladda upp bild"
          >
            <Upload size={14} />
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

// 🔥 NY: Custom Node View för bilder (hanterar resize och alignment)
const ImageNodeView = ({
  node,
  updateAttributes,
  deleteNode,
  selected,
  editor,
}: any) => {
  // Visa bara selection om noden är vald OCH editorn är redigerbar
  const isSelected = selected && editor.isEditable;

  // Hantera storleksändring (drag)
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    // Hämta nuvarande bredd (ta bort 'px' om det finns)
    const startWidth = parseInt(node.attrs.width || "300", 10);

    const onMouseMove = (e: MouseEvent) => {
      const currentX = e.clientX;
      const diffInPx = currentX - startX;
      const newWidth = Math.max(50, startWidth + diffInPx); // Minst 50px
      updateAttributes({ width: `${newWidth}px` });
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Justering
  const align = node.attrs.align || "center";
  let justifyContent = "center";
  if (align === "left") justifyContent = "flex-start";
  if (align === "right") justifyContent = "flex-end";

  return (
    <NodeViewWrapper
      style={{
        display: "flex",
        justifyContent,
        position: "relative",
        margin: "12px 0",
      }}
    >
      <div style={{ position: "relative", display: "inline-block" }}>
        <img
          src={node.attrs.src}
          alt={node.attrs.alt}
          style={{
            width: node.attrs.width,
            maxWidth: "100%",
            borderRadius: "8px",
            border: isSelected ? "2px solid #6366f1" : "2px solid transparent",
            display: "block",
          }}
        />

        {/* Kontroller som visas när bilden är vald */}
        {isSelected && (
          <>
            {/* Justeringsknappar */}
            <div
              style={{
                position: "absolute",
                top: -40,
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(30, 30, 35, 0.9)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.1)",
                padding: "6px",
                borderRadius: "8px",
                display: "flex",
                gap: "6px",
                boxShadow: "0 10px 20px -5px rgba(0,0,0,0.5)",
                zIndex: 10,
              }}
            >
              <button
                onClick={() => updateAttributes({ align: "left" })}
                style={{
                  background: align === "left" ? "#6366f1" : "transparent",
                  border: "none",
                  color: "white",
                  borderRadius: 4,
                  padding: 4,
                  cursor: "pointer",
                }}
              >
                <AlignLeft size={14} />
              </button>
              <button
                onClick={() => updateAttributes({ align: "center" })}
                style={{
                  background: align === "center" ? "#6366f1" : "transparent",
                  border: "none",
                  color: "white",
                  borderRadius: 4,
                  padding: 4,
                  cursor: "pointer",
                }}
              >
                <AlignCenter size={14} />
              </button>
              <button
                onClick={() => updateAttributes({ align: "right" })}
                style={{
                  background: align === "right" ? "#6366f1" : "transparent",
                  border: "none",
                  color: "white",
                  borderRadius: 4,
                  padding: 4,
                  cursor: "pointer",
                }}
              >
                <AlignRight size={14} />
              </button>
            </div>

            {/* Ta bort-knapp (litet kryss) */}
            <button
              onClick={() => deleteNode()}
              onMouseDown={(e) => e.preventDefault()}
              style={{
                position: "absolute",
                top: -10,
                right: -10,
                background: "#ef4444",
                color: "white",
                border: "2px solid #1e1e24",
                borderRadius: "8px",
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                zIndex: 20,
                boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
              }}
              title="Ta bort bild"
            >
              <X size={12} strokeWidth={3} />
            </button>

            {/* Resize Handle (Drag i höger kant) */}
            <div
              onMouseDown={handleMouseDown}
              style={{
                position: "absolute",
                right: -8,
                bottom: "50%",
                transform: "translateY(50%)",
                width: "8px",
                height: "32px",
                background: "#6366f1",
                borderRadius: "4px",
                cursor: "ew-resize",
                zIndex: 10,
                border: "1px solid rgba(255,255,255,0.5)",
                boxShadow: "0 0 10px rgba(99, 102, 241, 0.5)",
              }}
            />
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
};

// 🔥 NY: Custom Image Extension som använder vår Node View
const CustomImage = ImageExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: "300px" }, // 🔥 Standardbredd: 300px (ganska liten)
      align: { default: "center" },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

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

  const [modalType, setModalType] = useState<"link" | "image" | null>(null);

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
      CustomImage.configure({
        inline: false, // Tvinga block-nivå för att alignment ska funka bra
      }),
      FontSize, // 🔥 Lägg till FontSize
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
    onBlur: ({ event }) => {
      // 🔥 FIX: Stäng inte editorn om vi klickar inuti menyn (t.ex. dropdown)
      if (
        event.relatedTarget &&
        (event.relatedTarget as HTMLElement).closest(
          ".rich-text-editor-wrapper",
        )
      ) {
        return;
      }
      onBlur(); // Annars, stäng editorn
    },
    editorProps: {
      attributes: {
        // VIKTIGT: 'nodrag' läggs till villkorligt. Utan den kan vi dra noden via texten.
        class: `focus:outline-none text-white ${
          isEditing ? "nodrag" : ""
        } tiptap`, // 🔥 FIX: Lägg till 'tiptap' klassen så NoteNode kan hitta och mäta den
        // 🔥 FIX: Ta bort min-height härifrån, låt containern styra. height: 100% fyller ut.
        style:
          "min-height: 100%; outline: none; font-size: inherit; line-height: 1.5;",
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

      if (!isEditing) {
        // Rensa selection när vi lämnar edit-läget så inte bilder fortsätter vara valda
        editor.commands.setTextSelection(0);
      }

      // Uppdatera klasser dynamiskt: Lägg till 'nodrag' endast i edit-mode
      editor.setOptions({
        editorProps: {
          attributes: {
            class: `focus:outline-none text-white ${
              isEditing ? "nodrag" : ""
            } tiptap`, // 🔥 FIX: Lägg till 'tiptap' här också
            // 🔥 FIX: Använd flex: 1 istället för min-height: 100% för att undvika overflow-loopar med menyn
            style:
              "flex: 1; outline: none; font-size: inherit; line-height: 1.5;",
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
        flex: 1, // 🔥 FIX: Använd flex för att fylla ut föräldern istället för height: 100%
        minHeight: 0, // 🔥 FIX: Tillåt krympning för att undvika flex-overflow
        flexShrink: 0,
        boxSizing: "border-box",
      }}
    >
      {isEditing && (
        <MenuBar
          editor={editor}
          isListening={isListening}
          onToggleVoice={isListening ? stopListening : startListening}
          onImageUpload={onImageUpload}
          hasVoiceSupport={hasSupport}
          onLinkClick={() => setModalType("link")}
          onImageUrlClick={() => setModalType("image")}
        />
      )}
      <EditorContent
        editor={editor}
        style={{
          width: "100%",
          cursor: isEditing ? "text" : "default",
          // Enkel styling för HTML-innehållet
          fontSize: "inherit", // 🔥 FIX: Ärv font-size från NoteNode
          lineHeight: "inherit", // 🔥 FIX: Ärv line-height
          overflowWrap: "anywhere", // 🔥 FIX: Bryt långa ord (bättre än break-word)
          wordBreak: "break-word",
          flex: 1, // 🔥 FIX: Låt editor-content fylla ut wrappern
          display: "flex", // 🔥 FIX: Gör editor-content till flex-container
          flexDirection: "column",
        }}
        className="tiptap-container"
      />

      {/* Modaler */}
      {modalType === "link" && (
        <ImageUrlModal
          title="Infoga länk"
          placeholder="https://..."
          onConfirm={(url) => {
            if (url) {
              editor
                ?.chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href: url })
                .run();
            } else {
              editor?.chain().focus().extendMarkRange("link").unsetLink().run();
            }
            setModalType(null);
          }}
          onClose={() => setModalType(null)}
        />
      )}

      {modalType === "image" && (
        <ImageUrlModal
          title="Infoga bild från URL"
          placeholder="https://exempel.se/bild.png"
          onConfirm={(url) => {
            if (url) {
              editor?.chain().focus().setImage({ src: url }).run();
            }
            setModalType(null);
          }}
          onClose={() => setModalType(null)}
        />
      )}

      <style>{`
        .tiptap p { margin: 0 0 8px 0; }
        .tiptap ul, .tiptap ol { padding-left: 20px; margin: 4px 0; }
        .tiptap p:last-child { margin-bottom: 0; } /* 🔥 FIX: Stoppa margin-loop */
        .tiptap ul { list-style-type: disc; }
        .tiptap ol { list-style-type: decimal; }
        .tiptap h1 { font-size: 1.6em; font-weight: bold; margin-bottom: 8px; }
        .tiptap h2 { font-size: 1.4em; font-weight: bold; margin-bottom: 6px; }
        .tiptap h3 { font-size: 1.2em; font-weight: bold; margin-bottom: 4px; }
        .tiptap a { color: #6366f1; text-decoration: underline; cursor: pointer; }
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
