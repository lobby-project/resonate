// /chat 索引页:数据获取已上移到 layout.tsx。
// 手机端:此空态被 CSS 隐藏(at-index 时只显示列表)。
// 桌面端:右栏的"选一个对话"占位。
export default function ChatPage() {
  return (
    <div className="screen convo chat-empty-state">
      <div className="empty">
        <span className="big">SELECT A CONVERSATION</span>
        PICK A ROOM OR A MATCH FROM THE LEFT ●
      </div>
    </div>
  );
}
