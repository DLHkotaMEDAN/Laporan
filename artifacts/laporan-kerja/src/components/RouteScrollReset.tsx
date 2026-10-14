import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * React Router keeps the current document scroll position during client-side
 * navigation. Reset it when opening another page so a long dashboard or
 * recap cannot make the new recap content appear to be missing.
 */
const RouteScrollReset = () => {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
};

export default RouteScrollReset;
