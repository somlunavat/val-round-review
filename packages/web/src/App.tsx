import { Footer } from "./components/Footer.js";
import { ReviewPage } from "./pages/ReviewPage.js";

export function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-neutral-800 px-6 py-4">
        <h1 className="text-xl font-semibold">Replay Lab</h1>
        <p className="text-sm text-neutral-400">Review key moments from your own matches.</p>
      </header>
      <main className="flex-1 p-6">
        <ReviewPage />
      </main>
      <Footer />
    </div>
  );
}
