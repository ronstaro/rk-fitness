/**
 * PageHeader
 * Used at the top of every admin and trainee page.
 *
 * Props:
 *   title  {string}           – main heading (DM Serif Display font via CSS)
 *   sub    {string|ReactNode} – optional subtitle / meta line
 *   action {ReactNode}        – optional button/element floated to the opposite side
 *
 * Example:
 *   <PageHeader
 *     title="לידים"
 *     sub="4 לידים במערכת"
 *     action={<button className="btn btn-primary btn-sm">+ הוסף ליד</button>}
 *   />
 */
export default function PageHeader({ title, sub, action }) {
  return (
    <div
      className="page-header"
      style={action ? { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 } : undefined}
    >
      <div>
        <div className="page-header-title">{title}</div>
        {sub && <div className="page-header-sub">{sub}</div>}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
