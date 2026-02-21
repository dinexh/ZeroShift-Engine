-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('PENDING', 'DEPLOYING', 'ACTIVE', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "DeploymentColor" AS ENUM ('BLUE', 'GREEN');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "localPath" TEXT NOT NULL,
    "appPort" INTEGER NOT NULL,
    "healthPath" TEXT NOT NULL DEFAULT '/health',
    "basePort" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "imageTag" TEXT NOT NULL,
    "containerName" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "color" "DeploymentColor" NOT NULL,
    "status" "DeploymentStatus" NOT NULL DEFAULT 'PENDING',
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_name_key" ON "Project"("name");

-- CreateIndex
CREATE INDEX "Project_name_idx" ON "Project"("name");

-- CreateIndex
CREATE INDEX "Deployment_status_idx" ON "Deployment"("status");

-- CreateIndex
CREATE INDEX "Deployment_createdAt_idx" ON "Deployment"("createdAt");

-- CreateIndex
CREATE INDEX "Deployment_projectId_idx" ON "Deployment"("projectId");

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
