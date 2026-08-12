import { SearchForm } from "@/components/SearchForm";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center gap-10 px-6 py-20 text-center">
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Reserve Your Table</h1>
        <p className="max-w-xl text-lg text-muted">
          Search real-time availability across our dining room, patio, bar, and private
          rooms — then book in a couple of clicks.
        </p>
      </div>
      <div className="w-full text-left">
        <SearchForm />
      </div>
    </main>
  );
}
