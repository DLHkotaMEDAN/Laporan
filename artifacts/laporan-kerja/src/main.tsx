import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";

// Setup React Query dengan konfigurasi optimasi
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data selama 5 menit untuk menghindari re-fetch yang tidak perlu
      staleTime: 5 * 60 * 1000,
      // Cache di-maintain selama 10 menit
      gcTime: 10 * 60 * 1000,
      // Retry 1 kali jika gagal
      retry: 1,
      // Tidak refetch saat window focus (hemat bandwidth)
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
