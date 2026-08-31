import { Link } from "../router";

export function NotFound({ path }: { path: string }) {
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Not found</h1>
          <p className="page-sub">
            Nothing lives at <code>{path}</code>.
          </p>
        </div>
      </header>
      <p>
        <Link className="btn btn-primary" to="/">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
