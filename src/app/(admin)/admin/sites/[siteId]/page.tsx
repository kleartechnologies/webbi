import { SiteDetailView } from "./SiteDetailView";

/** The site id is read in the browser (useParams) so the server HTML never carries it. */
export default function AdminSitePage() {
  return <SiteDetailView />;
}
