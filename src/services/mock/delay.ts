export async function delay (duration = 300): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, duration))
}
