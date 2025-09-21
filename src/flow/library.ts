import { DEFAULT_PING_INTERVAL, type BaseNodeData, type BlockVariant } from "./nodes/types";

export type LibraryCategory = "Источники" | "Логика" | "Доставка";

export type LibraryNodeTemplate = {
  templateId: string;
  type: BlockVariant;
  category: LibraryCategory;
  data: BaseNodeData;
};

export const NODE_LIBRARY: LibraryNodeTemplate[] = [
  {
    templateId: "website-uptime",
    type: "website",
    category: "Источники",
    data: {
      title: "Мониторинг сайта",
      emoji: "🌐",
      description: "https://pingtower.com",
      status: "idle",
      ping_interval: DEFAULT_PING_INTERVAL,
      metadata: [
        { label: "URL", value: "https://pingtower.com" },
        { label: "Название", value: "Мониторинг сайта" },
        { label: "Интервал", value: `${DEFAULT_PING_INTERVAL} сек` },
      ],
    },
  },
  {
    templateId: "llm-autoreply",
    type: "llm",
    category: "Логика",
    data: {
      title: "LLM-ответчик",
      emoji: "🤖",
      description: "Генерирует персональные ответы клиентам",
      status: "idle",
      metadata: [
        { label: "Темп", value: "0.5" },
        { label: "Язык", value: "RU" },
      ],
    },
  },
  {
    templateId: "messenger-telegram",
    type: "messenger",
    category: "Доставка",
    data: {
      title: "Telegram бот",
      emoji: "📲",
      description: "Отправляет уведомления в Telegram",
      status: "idle",
      metadata: [
        { label: "Канал", value: "@pingtower" },
        { label: "Формат", value: "Markdown" },
      ],
    },
  },
];
