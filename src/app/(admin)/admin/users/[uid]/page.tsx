import { UserDetailView } from "./UserDetailView";

/** The uid is read in the browser (useParams) so the server HTML never carries it. */
export default function AdminUserPage() {
  return <UserDetailView />;
}
