import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from './cn'
import { SkeletonRows, StateView, type StateViewProps } from './feedback'

export interface Column<T> {
  key: string
  header: ReactNode
  /** Cell renderer. */
  cell: (row: T) => ReactNode
  /** Return a comparable value to make the column sortable. */
  sortBy?: (row: T) => string | number
  align?: 'left' | 'right' | 'center'
  /** Tailwind width class, e.g. 'w-32'. */
  width?: string
  /** Hidden below the `sm` breakpoint. */
  hideOnMobile?: boolean
}

export interface DataTableProps<T> {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  /** Rendered in the far-right column on hover / focus. */
  rowActions?: (row: T) => ReactNode
  loading?: boolean
  /** Shown when `rows` is empty and not loading. */
  emptyState?: Omit<StateViewProps, 'kind'>
  initialSort?: { key: string; direction: 'asc' | 'desc' }
  /** Highlights a row, e.g. the currently open record. */
  isActive?: (row: T) => boolean
  className?: string
  /** Sticks the header while the body scrolls. */
  stickyHeader?: boolean
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  rowActions,
  loading = false,
  emptyState,
  initialSort,
  isActive,
  className,
  stickyHeader = true,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort ?? null)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const column = columns.find((c) => c.key === sort.key)
    if (!column?.sortBy) return rows
    const { sortBy } = column
    // Copy before sorting — never mutate the caller's array.
    return [...rows].sort((a, b) => {
      const av = sortBy(a)
      const bv = sortBy(b)
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sort.direction === 'asc' ? cmp : -cmp
    })
  }, [rows, columns, sort])

  const toggleSort = (key: string) => {
    setSort((current) =>
      current?.key === key
        ? current.direction === 'asc'
          ? { key, direction: 'desc' }
          : null // third click clears the sort
        : { key, direction: 'asc' },
    )
  }

  const alignOf = (align: Column<T>['align']) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'

  if (loading) {
    return (
      <div className={cn('overflow-hidden rounded-xl border border-default bg-surface', className)}>
        <SkeletonRows cols={Math.min(columns.length, 5)} />
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <div className={cn('overflow-hidden rounded-xl border border-default bg-surface', className)}>
        <StateView kind="empty" {...emptyState} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'scrollbar-thin overflow-x-auto rounded-xl border border-default bg-surface',
        className,
      )}
    >
      <table className="w-full border-collapse text-sm">
        <thead
          className={cn(
            'bg-surface-sunken text-xs',
            stickyHeader && 'sticky top-0 z-10',
          )}
        >
          <tr>
            {columns.map((column) => {
              const active = sort?.key === column.key
              const SortIcon = !active ? ChevronsUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={cn(
                    'border-b border-default px-4 py-2.5 font-medium text-muted',
                    alignOf(column.align),
                    column.width,
                    column.hideOnMobile && 'hidden sm:table-cell',
                  )}
                >
                  {column.sortBy ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        'group inline-flex cursor-pointer items-center gap-1 rounded hover:text-text',
                        active && 'text-text',
                        column.align === 'right' && 'flex-row-reverse',
                      )}
                    >
                      {column.header}
                      <SortIcon
                        aria-hidden
                        className={cn(
                          'size-3 transition-opacity',
                          active ? 'opacity-100' : 'opacity-0 group-hover:opacity-60',
                        )}
                      />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              )
            })}
            {rowActions && <th className="w-10 border-b border-default" />}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const active = isActive?.(row)
            return (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                // Rows are reachable and activatable by keyboard when clickable.
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onRowClick(row)
                        }
                      }
                    : undefined
                }
                className={cn(
                  'group border-b border-default/60 last:border-0',
                  'transition-colors duration-(--duration-fast)',
                  onRowClick && 'cursor-pointer hover:bg-surface-hover',
                  active && 'bg-brand-bg/60 hover:bg-brand-bg',
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 py-2.5 text-text',
                      alignOf(column.align),
                      column.hideOnMobile && 'hidden sm:table-cell',
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
                {rowActions && (
                  <td
                    className="px-2 py-2.5 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                      {rowActions(row)}
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Two-line cell: a strong primary line over a muted secondary line. */
export function CellStack({ primary, secondary }: { primary: ReactNode; secondary?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-medium text-text">{primary}</div>
      {secondary && <div className="truncate text-xs text-muted">{secondary}</div>}
    </div>
  )
}
