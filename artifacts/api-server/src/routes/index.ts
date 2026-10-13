import { Router, type IRouter } from "express";
import healthRouter from "./health";
import pdfRouter from "./pdf";
import googleDriveRouter from "./google-drive";

const router: IRouter = Router();

router.use(healthRouter);
router.use(pdfRouter);
router.use(googleDriveRouter);

export default router;
