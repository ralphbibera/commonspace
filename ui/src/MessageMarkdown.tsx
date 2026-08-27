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
    <div className="csp-markdown-table-wrap">
      <table className={className} {...props} />
    </div>
  )
}

function MarkdownImage({ alt, node, src }: ComponentProps<'img'> & { node?: unknown }) {
  void node
  const label = alt?.trim() || 'Untitled image'
  const externalSource = src !== undefined && /^https?:\/\//i.test(src) ? src : undefined
  return (
    <span className="csp-markdown-image-placeholder" role="note">
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
    <div className="csp-message-content" data-selectable-text="true">
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
