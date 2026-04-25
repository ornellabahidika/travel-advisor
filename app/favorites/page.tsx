import { Header } from "@/app/components/Header";
import { FavoritesList } from "@/app/components/FavoritesList";

export default function FavoritesPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <Header />
      <FavoritesList />
    </main>
  );
}
