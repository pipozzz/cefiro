import { router } from "../../trpc";
import { socialProcedures } from "./social";

export const socialRouter = router({
  ...socialProcedures._def.procedures,
});
