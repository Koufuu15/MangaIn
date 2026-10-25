const databaseName = 'mangain-word-manga'
const objectStoreName = 'images'

let databasePromise

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(databaseName, 1)

      request.onupgradeneeded = () => {
        request.result.createObjectStore(objectStoreName)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => {
        databasePromise = undefined
        reject(request.error ?? new Error('画像ストレージを開けませんでした。'))
      }
      request.onblocked = () => {
        databasePromise = undefined
        reject(new Error('画像ストレージが別のタブで使用中です。'))
      }
    })
  }

  return databasePromise
}

async function runImageTransaction(mode, operation) {
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(objectStoreName, mode)
    const request = operation(transaction.objectStore(objectStoreName))

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('画像を保存できませんでした。'))
    transaction.onabort = () => reject(transaction.error ?? new Error('画像の保存に失敗しました。'))
  })
}

export function saveWordMangaImage(id, image) {
  return runImageTransaction('readwrite', (store) => store.put(image, id))
}

export function loadWordMangaImages(ids) {
  return Promise.all(
    ids.map(async (id) => {
      const image = await runImageTransaction('readonly', (store) => store.get(id))
      return image ? [id, image] : null
    }),
  ).then((entries) => Object.fromEntries(entries.filter(Boolean)))
}

export function deleteWordMangaImage(id) {
  return runImageTransaction('readwrite', (store) => store.delete(id))
}
