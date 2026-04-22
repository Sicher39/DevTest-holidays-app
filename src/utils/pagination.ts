export function formatPaginationLabel (currentPage: number, itemsPerPage: number, totalItems: number): string {
  if (totalItems === 0) {
    return '0-0 z 0'
  }

  const start = (currentPage - 1) * itemsPerPage + 1
  const end = Math.min(currentPage * itemsPerPage, totalItems)

  return `${start}-${end} z ${totalItems}`
}
