import { useEffect } from "react";
import { Footer } from "./components/Footer.js";
import { TopBar } from "./components/TopBar.js";
import { ReviewPage } from "./pages/ReviewPage.js";
import { useReview } from "./state/store.js";

export function App() {
  const session = useReview((s) => s.session);
  const init = useReview((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar session={session.status === "ready" ? session.data : undefined} />
      <main className="flex-1">
        <ReviewPage />
      </main>
      <Footer />
    </div>
  );
}
