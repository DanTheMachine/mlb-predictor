type TeamCardProps = {
  title: string
  summary: string
}

export function TeamCard({ title, summary }: TeamCardProps) {
  return (
    <article className="panel">
      <h2>{title}</h2>
      <p>{summary}</p>
    </article>
  )
}
