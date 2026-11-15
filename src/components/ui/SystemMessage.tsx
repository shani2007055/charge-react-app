
import {
  CircleCheck,
  CircleAlert,
  TriangleAlert,
  LoaderCircle,
  Info,
  X
} from 'lucide-react';

import './SystemMessage.css';

type MessageType =
  | 'success'
  | 'error'
  | 'warning'
  | 'loading'
  | 'info';

interface SystemMessageProps {
  type: MessageType;
  message: string;
  onClose?: () => void;
}

const icons = {
  success: CircleCheck,
  error: CircleAlert,
  warning: TriangleAlert,
  loading: LoaderCircle,
  info: Info
};

export default function SystemMessage({
  type,
  message,
  onClose
}: SystemMessageProps) {

  if (!message) return null;

  const Icon = icons[type];

  return (

    <div
      dir="rtl"
      className={`system-message message-${type}`}
      role={type === 'error' ? 'alert' : 'status'}
    >

      <Icon
        size={22}
        className={
          type === 'loading'
            ? 'message-spinner'
            : ''
        }
      />

      <span>{message}</span>

      {onClose && (
        <button
          type="button"
          aria-label="סגירת הודעה"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      )}

    </div>
  );
}
