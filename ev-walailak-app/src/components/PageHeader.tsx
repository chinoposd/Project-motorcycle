interface PageHeaderProps {
  title: string;
  description: string;
  badge?: string;
}

export default function PageHeader({ title, description, badge }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div><h1>{title}</h1><p>{description}</p></div>
      {badge && <span className="page-badge">{badge}</span>}
    </div>
  );
}
