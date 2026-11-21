-- CreateTable
CREATE TABLE "TemplateImage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemplateImage_organizationId_createdAt_idx" ON "TemplateImage"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateImage_organizationId_filename_key" ON "TemplateImage"("organizationId", "filename");

-- AddForeignKey
ALTER TABLE "TemplateImage" ADD CONSTRAINT "TemplateImage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

