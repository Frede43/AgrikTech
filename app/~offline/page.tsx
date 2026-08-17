import { WifiOff } from 'lucide-react'

export const metadata = {
  title: 'Hors ligne',
}

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <WifiOff className="h-8 w-8" />
      </div>
      <h1 className="text-xl font-bold text-emerald-900">Vous êtes hors ligne</h1>
      <p className="max-w-sm text-sm text-emerald-700">
        Cette page n'est pas disponible sans connexion internet. Vérifiez votre
        réseau, les pages et données déjà consultées restent accessibles.
      </p>
      <a
        href="/"
        className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
      >
        Retour à l'accueil
      </a>
    </div>
  )
}
