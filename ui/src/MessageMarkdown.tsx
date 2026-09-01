import { memo, type ComponentProps } from 'react'
import { Streamdown, type Components } from 'streamdown'

function MarkdownLink({ href, node, ...props }: ComponentProps<'a'> & { node?: unknown }) {
  void node
  const external = href !== undefined && /^https?:\/\//i.test(href)
  return <a {...props} href={href} rel={external ? 'noopener noreferrer' : undefined} target={external ? '_blank' : undefined} />
}

function MarkdownTable({ className, node, ...props }: ComponentProps<'table'> & { node?: unknown }) {
  void node
  return (
    <div className="my-3 max-w-full overflow-x-auto rounded-md border">
      <table className={className} {...props} />
    </div>
  )
}

function MarkdownImage({ alt, node, src }: ComponentProps<'img'> & { node?: unknown }) {
  void node
  const label = alt?.trim() || 'Untitled image'
  const externalSource = src !== undefined && /^https?:\/\//i.test(src) ? src : undefined
  return (
    <span className="my-2 inline-flex min-h-11 flex-wrap items-center gap-2 rounded-md border bg-muted px-3 text-xs text-muted-foreground" role="note">
      <span>Image withheld · {label}</span>
      {externalSource !== undefined
        ? <a href={externalSource} rel="noopener noreferrer" target="_blank" aria-label={`Open image: ${label}`}>Open image</a>
        : null}
    </span>
  )
}

const components = {
  a: MarkdownLink,
  img: MarkdownImage,
  table: MarkdownTable,
} satisfies Components

const markdownControls = {
  code: { copy: true, download: false },
  table: { copy: true, download: false, fullscreen: false },
} as const

export const MessageMarkdown = memo(function MessageMarkdown({ text }: { text: string }) {
  return (
    <div className="min-w-0 text-sm leading-6 break-words [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_code]:font-mono [&_li]:my-1 [&_ol]:my-2 [&_ol]:pl-6 [&_p]:my-2 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:bg-muted [&_pre]:p-3 [&_table]:w-full [&_td]:border-t [&_td]:p-2 [&_th]:p-2 [&_ul]:my-2 [&_ul]:pl-6" data-selectable-text="true">
      <Streamdown
        components={components}
        controls={markdownControls}
        dir="auto"
        lineNumbers={false}
        mode="static"
        parseIncompleteMarkdown={false}
      >
        {text}
      </Streamdown>
    </div>
  )
})
