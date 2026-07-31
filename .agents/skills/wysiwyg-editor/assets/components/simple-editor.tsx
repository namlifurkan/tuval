"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useCallback, useState } from "react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface SimpleEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function SimpleEditor({
  value,
  onChange,
  placeholder = "Write your message...",
  editable = true,
  className,
  onKeyDown,
}: SimpleEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Disabled for simple editor - enable as needed
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-2",
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass:
          "before:content-[attr(data-placeholder)] before:text-muted-foreground before:absolute before:opacity-50 before:pointer-events-none",
      }),
    ],
    content: value,
    editable,
    editorProps: {
      attributes: {
        // CRITICAL: These classes enable proper list rendering
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[120px] px-3 py-2",
          "prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0",
          "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"
        ),
      },
      handleKeyDown: (_view, event) => {
        if (onKeyDown) {
          const syntheticEvent = event as unknown as React.KeyboardEvent;
          onKeyDown(syntheticEvent);
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // Return empty string if only contains empty paragraph
      if (html === "<p></p>") {
        onChange("");
      } else {
        onChange(html);
      }
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      const currentHtml = editor.getHTML();
      const normalizedValue = value || "<p></p>";
      if (normalizedValue !== currentHtml && value !== "") {
        editor.commands.setContent(value);
      } else if (value === "" && currentHtml !== "<p></p>") {
        editor.commands.setContent("");
      }
    }
  }, [editor, value]);

  if (!editor) {
    return null;
  }

  return (
    <div
      className={cn(
        "border rounded-md bg-transparent overflow-hidden",
        "focus-within:border-primary",
        className
      )}
    >
      {/* Toolbar */}
      <EditorToolbar editor={editor} />

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  );
}

interface EditorToolbarProps {
  editor: ReturnType<typeof useEditor>;
}

function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Bold"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Italic"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>

      <div className="w-px h-4 bg-border mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="Bullet list"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title="Numbered list"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>

      <div className="w-px h-4 bg-border mx-1" />

      <LinkButton editor={editor} />
    </div>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, active, title, children }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      title={title}
      className={cn(
        "h-7 w-7 p-0 cursor-pointer",
        active && "bg-muted text-foreground"
      )}
    >
      {children}
    </Button>
  );
}

function LinkButton({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  const isActive = editor.isActive("link");

  const handleSetLink = useCallback(() => {
    if (!url) {
      editor.chain().focus().unsetLink().run();
    } else {
      const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
      editor.chain().focus().setLink({ href: normalizedUrl }).run();
    }
    setOpen(false);
    setUrl("");
  }, [editor, url]);

  const handleUnlink = useCallback(() => {
    editor.chain().focus().unsetLink().run();
  }, [editor]);

  if (isActive) {
    return (
      <ToolbarButton onClick={handleUnlink} active title="Remove link">
        <Unlink className="h-4 w-4" />
      </ToolbarButton>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title="Add link"
          className="h-7 w-7 p-0 cursor-pointer"
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-2">
          <Input
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSetLink();
              }
            }}
          />
          <Button size="sm" onClick={handleSetLink} className="w-full cursor-pointer">
            Add link
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
