/**
 * Scroll to first validation error in a form.
 * Finds the first element with an error message (data-error attribute or .text-red-500)
 * and smoothly scrolls it into view.
 */
export function scrollToFirstError(containerSelector?: string) {
  // Small delay to allow DOM to update with error messages
  setTimeout(() => {
    const container = containerSelector
      ? document.querySelector(containerSelector)
      : document

    if (!container) return

    // Find first error message element
    const errorEl = container.querySelector(
      '.text-red-500, [data-error="true"], .text-destructive'
    ) as HTMLElement | null

    if (errorEl) {
      // Try to find the parent form field (go up to find the input container)
      const formField = errorEl.closest('div') ?? errorEl
      formField.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })

      // Also try to focus the related input
      const input = formField.querySelector('input, select, textarea') as HTMLElement | null
      if (input) {
        setTimeout(() => input.focus(), 300)
      }
    }
  }, 50)
}
