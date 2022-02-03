import { AppProps } from "next/app";
import ToastContainer from "../components/ToastContainer";
import { ToastProvider } from "../context/ToastContext";
import "../styles/index.css";

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ToastProvider>
      <Component {...pageProps} />
      <ToastContainer />
    </ToastProvider>
  )
}
