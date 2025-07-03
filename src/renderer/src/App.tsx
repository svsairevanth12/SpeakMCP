import { RouterProvider } from "react-router-dom"
import { router } from "./router"
import { lazy, Suspense } from "react"
import { Toaster } from "sonner"

const Updater = lazy(() => import("./components/updater"))

function App(): JSX.Element {
  return (
    <>
      <RouterProvider router={router}></RouterProvider>

      <Suspense>
        <Updater />
      </Suspense>

      <Toaster />
    </>
  )
}

export default App
