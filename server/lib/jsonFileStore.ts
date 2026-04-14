import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

type Updater<T> = (currentValue: T) => T | Promise<T>

const defaultEncoding = 'utf8'

export class JsonFileStore {
  private readonly apiDirectoryPath: string
  private readonly operationByFilePath = new Map<string, Promise<unknown>>()

  constructor (apiDirectoryPath: string) {
    this.apiDirectoryPath = path.resolve(apiDirectoryPath)
  }

  async readJsonFile<T>(fileName: string, fallbackValue: T): Promise<T> {
    const filePath = this.resolveApiFilePath(fileName)

    try {
      const rawContent = await readFile(filePath, defaultEncoding)
      return this.parseJson<T>(rawContent, filePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return fallbackValue
      }

      throw error
    }
  }

  async writeJsonFile<T>(fileName: string, value: T): Promise<void> {
    const filePath = this.resolveApiFilePath(fileName)

    await this.enqueueOperation(filePath, async () => {
      await this.writeFileAtomically(filePath, value)
    })
  }

  async updateJsonFile<T>(fileName: string, fallbackValue: T, updater: Updater<T>): Promise<T> {
    const filePath = this.resolveApiFilePath(fileName)

    return this.enqueueOperation(filePath, async () => {
      const currentValue = await this.readJsonFile(fileName, fallbackValue)
      const updatedValue = await updater(currentValue)

      await this.writeFileAtomically(filePath, updatedValue)

      return updatedValue
    })
  }

  private resolveApiFilePath (fileName: string): string {
    const normalizedFileName = path.normalize(fileName)

    if (path.isAbsolute(normalizedFileName) || normalizedFileName.includes('..')) {
      throw new Error(`Neplatný název souboru: ${fileName}`)
    }

    const resolvedPath = path.resolve(this.apiDirectoryPath, normalizedFileName)

    if (!resolvedPath.startsWith(`${this.apiDirectoryPath}${path.sep}`)) {
      throw new Error(`Přístup mimo api/ není povolen: ${fileName}`)
    }

    return resolvedPath
  }

  private parseJson<T>(rawContent: string, filePath: string): T {
    try {
      return JSON.parse(rawContent) as T
    } catch {
      throw new Error(`Soubor ${filePath} neobsahuje validní JSON.`)
    }
  }

  private async writeFileAtomically<T>(filePath: string, value: T): Promise<void> {
    const temporaryFilePath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
    const serializedValue = `${JSON.stringify(value, null, 2)}\n`

    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(temporaryFilePath, serializedValue, defaultEncoding)
    await rename(temporaryFilePath, filePath)
  }

  private enqueueOperation<T>(filePath: string, operation: () => Promise<T>): Promise<T> {
    const previousOperation = this.operationByFilePath.get(filePath) ?? Promise.resolve()

    const nextOperation = previousOperation
      .catch(() => undefined)
      .then(operation)

    this.operationByFilePath.set(
      filePath,
      nextOperation.finally(() => {
        if (this.operationByFilePath.get(filePath) === nextOperation) {
          this.operationByFilePath.delete(filePath)
        }
      }),
    )

    return nextOperation
  }
}
