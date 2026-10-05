/**
 * Renders a schema.org JSON-LD block.
 *
 * Server component — no 'use client'. It emits a <script> tag and nothing
 * else, so it must never ship to the browser as a client bundle.
 *
 * The `<` escape is not optional. JSON.stringify happily emits the characters
 * `</script>` if any string in the payload contains them, which closes the tag
 * early and turns the rest of the document into executable markup. Replacing
 * `<` with its unicode escape is still valid JSON — the parser decodes it back
 * — but can no longer terminate the element.
 */
export function JsonLd({ data }: { data: object | object[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')

  return (
    <script
      type="application/ld+json"
      // The content is built by our own code from our own data, never from
      // user input, and is escaped above.
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
