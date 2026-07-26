import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FileText } from 'lucide-react'
import { Card, PageHeader, StateView, cn } from '@/design-system'

/**
 * Part 25 deliverable — the PRD, rendered from the same markdown that lives in
 * /docs/prd. Importing the files directly means the published site cannot
 * drift from the repo: there is one source of truth, not two.
 */
const FILES = import.meta.glob('../../../docs/prd/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

interface Doc {
  slug: string
  title: string
  order: number
  group: 'part' | 'screen'
  body: string
}

const DOCS: Doc[] = Object.entries(FILES)
  .map(([path, body]) => {
    const filename = path.split('/').pop()!.replace(/\.md$/, '')
    const isScreen = path.includes('/screens/')
    // Files are named NN-slug.md; the number drives ordering, not the title.
    const match = filename.match(/^(\d+)[-_]?(.*)$/)
    const order = match ? Number(match[1]) : 999
    const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim()

    return {
      slug: filename,
      title: heading ?? filename.replace(/^\d+[-_]?/, '').replace(/-/g, ' '),
      order,
      group: isScreen ? ('screen' as const) : ('part' as const),
      body,
    }
  })
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))

export function DocsPage() {
  const { slug } = useParams<{ slug?: string }>()
  const navigate = useNavigate()

  const parts = useMemo(() => DOCS.filter((d) => d.group === 'part'), [])
  const screens = useMemo(() => DOCS.filter((d) => d.group === 'screen'), [])

  const active = slug ? DOCS.find((d) => d.slug === slug) : parts[0]

  if (DOCS.length === 0) {
    return (
      <StateView
        kind="empty"
        size="page"
        icon={FileText}
        title="No documentation yet"
        description="PRD files live in /docs/prd and are rendered here automatically."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Product documentation"
        description="The PRD, rendered from the markdown in this repository"
      />

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Documentation" className="lg:sticky lg:top-20 lg:self-start">
          <Card padded={false}>
            <div className="scrollbar-thin max-h-[70vh] overflow-y-auto p-2">
              <p className="px-2 py-1 text-2xs font-semibold tracking-wider text-subtle uppercase">
                Parts
              </p>
              <ul className="flex flex-col gap-0.5">
                {parts.map((doc) => (
                  <li key={doc.slug}>
                    <Link
                      to={`/docs/${doc.slug}`}
                      className={cn(
                        'block truncate rounded-md px-2 py-1.5 text-sm',
                        doc.slug === active?.slug
                          ? 'bg-brand-bg font-medium text-brand-text'
                          : 'text-muted hover:bg-surface-hover hover:text-text',
                      )}
                    >
                      {doc.title}
                    </Link>
                  </li>
                ))}
              </ul>

              {screens.length > 0 && (
                <>
                  <p className="mt-3 px-2 py-1 text-2xs font-semibold tracking-wider text-subtle uppercase">
                    Screens
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {screens.map((doc) => (
                      <li key={doc.slug}>
                        <Link
                          to={`/docs/${doc.slug}`}
                          className={cn(
                            'block truncate rounded-md px-2 py-1.5 text-sm',
                            doc.slug === active?.slug
                              ? 'bg-brand-bg font-medium text-brand-text'
                              : 'text-muted hover:bg-surface-hover hover:text-text',
                          )}
                        >
                          {doc.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </Card>
        </nav>

        <Card>
          {!active ? (
            <StateView
              kind="error"
              title="Document not found"
              description="That document does not exist in /docs/prd."
              action={
                <button
                  type="button"
                  onClick={() => navigate('/docs')}
                  className="text-sm font-medium text-brand hover:underline"
                >
                  Back to the index
                </button>
              }
            />
          ) : (
            <article className="prose-onflows">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{active.body}</ReactMarkdown>
            </article>
          )}
        </Card>
      </div>
    </div>
  )
}
