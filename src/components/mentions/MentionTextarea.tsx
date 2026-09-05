import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { LuAtSign } from "react-icons/lu";
import { Textarea } from "src/components/ui/field";
import { Avatar } from "src/components/ui/media";
import { Text } from "src/components/ui/typography";
import { mentionSearchQueryOptions } from "src/lib/users/users.queries";

type MentionUser = {
  readonly id: string;
  readonly image: string | null;
  readonly name: string;
  readonly username: string;
};

type MentionTextareaProps = {
  /** aria-label forwarded to the underlying textarea. */
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly value: string;
};

/**
 * Matches the active mention trigger at the caret: an `@` (not preceded by a
 * username character) followed by 0–30 username characters, at the end of
 * the text before the caret. `null` when no mention is being typed.
 */
const MENTION_TRIGGER_REGEX = /(?:^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{0,30})$/;

const getTriggeredHandle = (value: string, caret: number): string | null => {
  const match = MENTION_TRIGGER_REGEX.exec(value.slice(0, caret));
  return match?.[1] ?? null;
};

/**
 * Textarea with @mention autocomplete: typing `@` opens a dropdown of
 * matching users; picking one replaces the partial handle with `@username `
 * at the caret. Keyboard: ↑/↓ move, Enter/Tab pick, Esc closes.
 */
export function MentionTextarea({
  label,
  onChange,
  placeholder,
  value,
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [triggeredHandle, setTriggeredHandle] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const { data: suggestions = [] } = useQuery({
    ...mentionSearchQueryOptions(triggeredHandle?.toLowerCase() ?? ""),
    enabled: triggeredHandle !== null && triggeredHandle.length > 0,
  });

  const users: readonly MentionUser[] = suggestions;
  const isOpen = triggeredHandle !== null && users.length > 0;
  const listId = "mention-suggestions";

  const closeMention = () => {
    setTriggeredHandle(null);
    setActiveIndex(0);
  };

  const refreshMention = (element: HTMLTextAreaElement) => {
    const caret = element.selectionStart ?? element.value.length;
    setTriggeredHandle(getTriggeredHandle(element.value, caret));
    setActiveIndex(0);
  };

  const insertMention = (user: MentionUser) => {
    const textarea = textareaRef.current;
    if (!textarea || triggeredHandle === null) {
      closeMention();
      return;
    }
    const caret = textarea.selectionStart ?? value.length;
    const start = caret - triggeredHandle.length - 1; // include the `@`
    if (start < 0) {
      closeMention();
      return;
    }
    const inserted = `@${user.username} `;
    const nextValue = value.slice(0, start) + inserted + value.slice(caret);
    const nextCaret = start + inserted.length;
    onChange(nextValue);
    closeMention();
    // Restore the caret once React has re-rendered the new value.
    requestAnimationFrame(() => {
      textarea.setSelectionRange(nextCaret, nextCaret);
    });
  };

  return (
    <div className="relative">
      <Textarea
        aria-activedescendant={
          isOpen ? `${listId}-option-${activeIndex}` : undefined
        }
        aria-autocomplete="list"
        aria-controls={isOpen ? listId : undefined}
        aria-expanded={isOpen}
        aria-label={label}
        id="comment-content"
        mb={2}
        onBlur={() => {
          closeMention();
        }}
        onChange={(e) => {
          onChange(e.target.value);
          refreshMention(e.target);
        }}
        onKeyDown={(e) => {
          if (!isOpen) {
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((index) => (index + 1) % users.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex(
              (index) => (index - 1 + users.length) % users.length,
            );
          } else if (e.key === "Enter" || e.key === "Tab") {
            const selected = users[activeIndex];
            if (selected === undefined) {
              return;
            }
            e.preventDefault();
            insertMention(selected);
          } else if (e.key === "Escape") {
            closeMention();
          }
        }}
        placeholder={placeholder}
        ref={textareaRef}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- custom ARIA combobox: the textarea holds inline @mention text and caret math; no native input/select/datalist can replace it
        role="combobox"
        value={value}
      />
      {isOpen && (
        <ul
          aria-label="User suggestions"
          className="absolute right-0 bottom-full left-0 z-10 mb-1 max-h-56 overflow-y-auto rounded border bg-white shadow-lg dark:bg-gray-900"
          id={listId}
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role, jsx-a11y/no-noninteractive-element-to-interactive-role -- custom ARIA listbox: ul/li carry the listbox role for the mention dropdown (avatars + active-descendant nav); a native datalist/select cannot render this inside a multiline textarea widget
          role="listbox"
        >
          {users.map((user, index) => (
            <li
              aria-selected={index === activeIndex}
              className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
              id={`${listId}-option-${index}`}
              key={user.id}
              // onMouseDown (not onClick) so the textarea keeps focus and
              // the pick happens before the blur closes the dropdown.
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(user);
              }}
              onMouseEnter={() => {
                setActiveIndex(index);
              }}
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role, jsx-a11y/no-noninteractive-element-to-interactive-role -- custom ARIA option: li carries the option role for the mention dropdown; native <option> requires a select/datalist parent and cannot render avatar rows
              role="option"
            >
              <Avatar.Root size="xs">
                {user.image && (
                  <Avatar.Image alt={user.name} src={user.image} />
                )}
                <Avatar.Fallback name={user.name} />
              </Avatar.Root>
              <Text fontSize="sm" fontWeight="medium">
                @{user.username}
              </Text>
              <Text color="gray.500" fontSize="sm">
                {user.name}
              </Text>
            </li>
          ))}
          <li
            aria-hidden="true"
            className="flex items-center gap-1 border-t px-3 py-1.5 text-xs text-gray-400"
          >
            <LuAtSign aria-hidden="true" /> Type to search users
          </li>
        </ul>
      )}
    </div>
  );
}
