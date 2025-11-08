# CI/CD Integration Guide

This guide provides comprehensive instructions for integrating Insula MCP into various CI/CD platforms.

## Table of Contents

- [GitHub Actions](#github-actions)
- [GitLab CI/CD](#gitlab-cicd)
- [Jenkins](#jenkins)
- [Azure DevOps](#azure-devops)
- [CircleCI](#circleci)
- [Best Practices](#best-practices)

## GitHub Actions

### Setup

1. Copy the workflow files to `.github/workflows/`:
   - `insula-mcp.yml` - Main CI workflow
   - `release.yml` - Release workflow
   - `deploy-production.yml` - Production deployment

2. Configure secrets in GitHub repository settings:

   ```
   DOCKER_USERNAME
   DOCKER_PASSWORD
   NPM_TOKEN
   INSULA_LICENSE_KEY
   AUTH0_DOMAIN
   AUTH0_CLIENT_ID
   AUTH0_CLIENT_SECRET
   KUBECONFIG (base64 encoded)
   SLACK_WEBHOOK_URL (optional)
   ```

### Usage

**Continuous Integration:**

```bash
# Automatically runs on push and pull requests
git push origin main
```

**Release:**

```bash
# Tag a release
git tag v1.0.0
git push origin v1.0.0
```

**Manual Deployment:**

```bash
# Use GitHub Actions UI to trigger deploy-production workflow
# Select environment (staging/production) and tier (community/professional/enterprise)
```

### Example Workflow

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20.11.1'
      - uses: pnpm/action-setup@v2
        with:
          version: '9.12.2'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

## GitLab CI/CD

### Setup

1. Copy `.gitlab-ci.yml` to your repository root

2. Configure CI/CD variables in GitLab project settings:

   ```
   DOCKER_REGISTRY
   DOCKER_IMAGE
   KUBECONFIG (base64 encoded, protected)
   INSULA_LICENSE_KEY (protected, masked)
   AUTH0_DOMAIN (protected)
   AUTH0_CLIENT_ID (protected)
   AUTH0_CLIENT_SECRET (protected, masked)
   ```

### Usage

**Continuous Integration:**

```bash
# Automatically runs on push
git push origin main
```

**Release and Deploy:**

```bash
# Tag a release
git tag v1.0.0
git push origin v1.0.0

# Manually trigger deployment from GitLab UI
# Navigate to CI/CD > Pipelines > Select pipeline > Manual jobs
```

### Pipeline Stages

1. **Validate** - Linting and code quality checks
2. **Build** - Compile TypeScript and bundle
3. **Test** - Run test suite with coverage
4. **Package** - Build Docker images for all tiers
5. **Deploy** - Deploy to Kubernetes (manual trigger)

## Jenkins

### Setup

1. Install required plugins:
   - Docker Pipeline
   - Kubernetes CLI
   - NodeJS
   - Pipeline

2. Create a new Pipeline job

3. Configure credentials:
   - Docker registry credentials
   - Kubernetes config file
   - License keys and secrets

### Jenkinsfile

```groovy
pipeline {
    agent any
    
    environment {
        NODE_VERSION = '20.11.1'
        PNPM_VERSION = '9.12.2'
        DOCKER_REGISTRY = 'registry.example.com'
        IMAGE_NAME = 'insula-mcp'
    }
    
    stages {
        stage('Setup') {
            steps {
                sh 'npm install -g pnpm@${PNPM_VERSION}'
                sh 'pnpm install --frozen-lockfile'
            }
        }
        
        stage('Lint') {
            steps {
                sh 'pnpm lint'
            }
        }
        
        stage('Test') {
            steps {
                sh 'pnpm test'
            }
        }
        
        stage('Build') {
            steps {
                sh 'pnpm build'
            }
        }
        
        stage('Docker Build') {
            when {
                tag pattern: "v\\d+\\.\\d+\\.\\d+", comparator: "REGEXP"
            }
            parallel {
                stage('Community') {
                    steps {
                        script {
                            docker.build("${DOCKER_REGISTRY}/${IMAGE_NAME}:${env.TAG_NAME}-community", 
                                "-f packages/insula-mcp/Dockerfile.community .")
                        }
                    }
                }
                stage('Professional') {
                    steps {
                        script {
                            docker.build("${DOCKER_REGISTRY}/${IMAGE_NAME}:${env.TAG_NAME}-professional", 
                                "-f packages/insula-mcp/Dockerfile.professional .")
                        }
                    }
                }
                stage('Enterprise') {
                    steps {
                        script {
                            docker.build("${DOCKER_REGISTRY}/${IMAGE_NAME}:${env.TAG_NAME}-enterprise", 
                                "-f packages/insula-mcp/Dockerfile.enterprise .")
                        }
                    }
                }
            }
        }
        
        stage('Deploy') {
            when {
                tag pattern: "v\\d+\\.\\d+\\.\\d+", comparator: "REGEXP"
            }
            steps {
                input message: 'Deploy to production?', ok: 'Deploy'
                withKubeConfig([credentialsId: 'kubeconfig']) {
                    sh '''
                        helm upgrade --install insula-mcp \
                            ./packages/insula-mcp/kubernetes/helm/insula-mcp \
                            --namespace insula-mcp \
                            --create-namespace \
                            --set image.tag=${TAG_NAME}-community \
                            --wait
                    '''
                }
            }
        }
    }
    
    post {
        always {
            cleanWs()
        }
        success {
            echo 'Pipeline succeeded!'
        }
        failure {
            echo 'Pipeline failed!'
        }
    }
}
```

## Azure DevOps

### Setup

1. Create a new pipeline in Azure DevOps

2. Configure service connections:
   - Docker registry
   - Kubernetes cluster
   - NPM registry

3. Create variable groups for secrets

### azure-pipelines.yml

```yaml
trigger:
  branches:
    include:
      - main
  tags:
    include:
      - v*

pool:
  vmImage: 'ubuntu-latest'

variables:
  nodeVersion: '20.11.1'
  pnpmVersion: '9.12.2'

stages:
- stage: Build
  jobs:
  - job: BuildAndTest
    steps:
    - task: NodeTool@0
      inputs:
        versionSpec: $(nodeVersion)
      displayName: 'Install Node.js'
    
    - script: |
        npm install -g pnpm@$(pnpmVersion)
        pnpm install --frozen-lockfile
      displayName: 'Install dependencies'
    
    - script: pnpm lint
      displayName: 'Run linter'
    
    - script: pnpm test
      displayName: 'Run tests'
    
    - script: pnpm build
      displayName: 'Build package'
    
    - publish: $(System.DefaultWorkingDirectory)/packages/insula-mcp/dist
      artifact: dist

- stage: Package
  condition: startsWith(variables['Build.SourceBranch'], 'refs/tags/')
  jobs:
  - job: DockerBuild
    strategy:
      matrix:
        community:
          tier: 'community'
        professional:
          tier: 'professional'
        enterprise:
          tier: 'enterprise'
    steps:
    - task: Docker@2
      inputs:
        containerRegistry: 'DockerHub'
        repository: 'brainwav/insula-mcp'
        command: 'buildAndPush'
        Dockerfile: 'packages/insula-mcp/Dockerfile.$(tier)'
        tags: |
          $(Build.SourceBranchName)-$(tier)
          latest-$(tier)

- stage: Deploy
  condition: and(succeeded(), startsWith(variables['Build.SourceBranch'], 'refs/tags/'))
  jobs:
  - deployment: DeployProduction
    environment: 'production'
    strategy:
      runOnce:
        deploy:
          steps:
          - task: HelmDeploy@0
            inputs:
              connectionType: 'Kubernetes Service Connection'
              kubernetesServiceConnection: 'k8s-cluster'
              namespace: 'insula-mcp'
              command: 'upgrade'
              chartType: 'FilePath'
              chartPath: 'packages/insula-mcp/kubernetes/helm/insula-mcp'
              releaseName: 'insula-mcp'
              overrideValues: 'image.tag=$(Build.SourceBranchName)-community'
              waitForExecution: true
```

## CircleCI

### Setup

1. Create `.circleci/config.yml` in your repository

2. Configure environment variables in CircleCI project settings

### config.yml

```yaml
version: 2.1

orbs:
  node: circleci/node@5.1.0
  docker: circleci/docker@2.2.0
  kubernetes: circleci/kubernetes@1.3.1

executors:
  node-executor:
    docker:
      - image: cimg/node:20.11.1
    working_directory: ~/repo

jobs:
  build-and-test:
    executor: node-executor
    steps:
      - checkout
      - run:
          name: Install pnpm
          command: npm install -g pnpm@9.12.2
      - restore_cache:
          keys:
            - v1-dependencies-{{ checksum "pnpm-lock.yaml" }}
      - run:
          name: Install dependencies
          command: pnpm install --frozen-lockfile
      - save_cache:
          paths:
            - node_modules
            - packages/insula-mcp/node_modules
          key: v1-dependencies-{{ checksum "pnpm-lock.yaml" }}
      - run:
          name: Lint
          command: pnpm lint
      - run:
          name: Test
          command: pnpm test
      - run:
          name: Build
          command: pnpm build
      - persist_to_workspace:
          root: ~/repo
          paths:
            - packages/insula-mcp/dist

  docker-build:
    executor: docker/docker
    parameters:
      tier:
        type: string
    steps:
      - checkout
      - setup_remote_docker
      - docker/check
      - docker/build:
          image: brainwav/insula-mcp
          tag: ${CIRCLE_TAG}-<< parameters.tier >>
          dockerfile: packages/insula-mcp/Dockerfile.<< parameters.tier >>
      - docker/push:
          image: brainwav/insula-mcp
          tag: ${CIRCLE_TAG}-<< parameters.tier >>

  deploy:
    executor: kubernetes/default
    steps:
      - checkout
      - kubernetes/install-kubectl
      - run:
          name: Install Helm
          command: |
            curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
      - run:
          name: Deploy to Kubernetes
          command: |
            helm upgrade --install insula-mcp \
              ./packages/insula-mcp/kubernetes/helm/insula-mcp \
              --namespace insula-mcp \
              --create-namespace \
              --set image.tag=${CIRCLE_TAG}-community \
              --wait

workflows:
  version: 2
  build-test-deploy:
    jobs:
      - build-and-test:
          filters:
            tags:
              only: /^v.*/
      - docker-build:
          name: docker-build-community
          tier: community
          requires:
            - build-and-test
          filters:
            tags:
              only: /^v.*/
            branches:
              ignore: /.*/
      - docker-build:
          name: docker-build-professional
          tier: professional
          requires:
            - build-and-test
          filters:
            tags:
              only: /^v.*/
            branches:
              ignore: /.*/
      - docker-build:
          name: docker-build-enterprise
          tier: enterprise
          requires:
            - build-and-test
          filters:
            tags:
              only: /^v.*/
            branches:
              ignore: /.*/
      - deploy:
          requires:
            - docker-build-community
            - docker-build-professional
            - docker-build-enterprise
          filters:
            tags:
              only: /^v.*/
            branches:
              ignore: /.*/
```

## Best Practices

### Security

1. **Never commit secrets** - Use CI/CD platform secret management
2. **Use protected branches** - Require reviews for main/production branches
3. **Scan Docker images** - Integrate security scanning (Trivy, Snyk)
4. **Sign images** - Use Docker Content Trust or Cosign
5. **Rotate credentials** - Regularly update API keys and tokens

### Performance

1. **Cache dependencies** - Cache node_modules and pnpm store
2. **Parallel builds** - Build Docker images in parallel
3. **Layer caching** - Optimize Dockerfile layer caching
4. **Incremental builds** - Only rebuild changed packages

### Reliability

1. **Health checks** - Verify deployment health before marking success
2. **Rollback strategy** - Implement automatic rollback on failure
3. **Smoke tests** - Run basic functionality tests post-deployment
4. **Monitoring** - Integrate with monitoring tools (Prometheus, Datadog)

### Deployment Strategy

1. **Blue-Green Deployment** - Zero-downtime deployments
2. **Canary Releases** - Gradual rollout to subset of users
3. **Feature Flags** - Control feature availability independently
4. **Database Migrations** - Run migrations before deployment

### Example: Blue-Green Deployment

```yaml
# Kubernetes blue-green deployment
- name: Deploy green
  run: |
    helm upgrade --install insula-mcp-green \
      ./helm/insula-mcp \
      --set service.selector.version=green \
      --wait

- name: Run smoke tests
  run: |
    kubectl run smoke-test --rm -i --restart=Never \
      --image=curlimages/curl -- \
      curl http://insula-mcp-green/health

- name: Switch traffic
  run: |
    kubectl patch service insula-mcp \
      -p '{"spec":{"selector":{"version":"green"}}}'

- name: Cleanup blue
  run: |
    helm uninstall insula-mcp-blue
```

## Troubleshooting

### Common Issues

**Build Failures:**

```bash
# Clear cache
pnpm store prune
rm -rf node_modules
pnpm install --frozen-lockfile
```

**Docker Build Failures:**

```bash
# Check Docker daemon
docker info

# Clear build cache
docker builder prune -a
```

**Deployment Failures:**

```bash
# Check pod status
kubectl get pods -n insula-mcp

# View logs
kubectl logs -n insula-mcp -l app.kubernetes.io/name=insula-mcp

# Describe pod
kubectl describe pod -n insula-mcp <pod-name>
```

## Support

For additional help:

- Documentation: https://brainwav.dev/docs/insula-mcp
- GitHub Issues: https://github.com/brainwav/insula-mcp/issues
- Community: https://discord.gg/brainwav
