import * as React from "react";

import { cn } from "@/lib/utils";

type MessageAlign = "start" | "end";

/**
 * Uma linha da conversa. `align="end"` joga a mensagem para a direita (quem escreve);
 * os filhos leem o lado pelo data-align, sem precisar repassar a prop.
 */
function Message({
  align = "start",
  className,
  ...props
}: React.ComponentProps<"div"> & { align?: MessageAlign }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn(
        "group/message flex w-full",
        align === "end" ? "justify-end" : "justify-start",
        className,
      )}
      {...props}
    />
  );
}

/** Coluna com cabeçalho, balão e rodapé. Fica do lado da linha e não passa de 85% da largura. */
function MessageContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-content"
      className={cn(
        "flex max-w-[85%] min-w-0 flex-col items-start gap-1.5 group-data-[align=end]/message:items-end",
        className,
      )}
      {...props}
    />
  );
}

/** Nome e hora: fica sempre no início do conteúdo, com o mesmo recuo horizontal do balão. */
function MessageHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-header"
      className={cn(
        "flex items-center self-start px-3.5 text-xs font-semibold text-[var(--chat-meta,#4e6b68)]",
        className,
      )}
      {...props}
    />
  );
}

/** Status ("Lida 09:41", "Editada"): acompanha o lado da linha. */
function MessageFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-footer"
      className={cn(
        "flex items-center self-start px-3.5 text-[11px] text-[var(--chat-meta,#4e6b68)] group-data-[align=end]/message:self-end",
        className,
      )}
      {...props}
    />
  );
}

export { Message, MessageContent, MessageFooter, MessageHeader };
export type { MessageAlign };
