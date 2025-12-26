import * as YAML from 'yaml';

export interface DataGeneratorOptions {
  size: 'small' | 'medium' | 'realistic' | 'large';
  complexity: 'flat' | 'nested' | 'deep';
  arraySize?: number;
}

/**
 * Generate a nested object with specified depth and breadth
 * @param depth - Number of nesting levels
 * @param breadth - Number of properties per level
 * @returns Deeply nested object
 */
export const generateNestedObject = (depth: number, breadth: number): Record<string, unknown> => {
  const createLevel = (currentDepth: number): Record<string, unknown> | string => {
    if (currentDepth === 0) return `value-at-depth-${depth}`;

    const object: Record<string, unknown> = {};
    for (let index = 0; index < breadth; index++) {
      const key = `level${depth - currentDepth}_prop${index}`;
      object[key] = createLevel(currentDepth - 1);
    }
    return object;
  };

  return createLevel(depth) as Record<string, unknown>;
};

/**
 * Generate realistic Helm values.yaml content
 */
const generateHelmValues = (options: DataGeneratorOptions): string => {
  const { size, complexity, arraySize = 10 } = options;

  const environmentCount = size === 'small' ? 5 : size === 'medium' ? 20 : size === 'realistic' ? 120 : 50;
  const replicaCount = size === 'small' ? 2 : size === 'medium' ? 5 : size === 'realistic' ? 8 : 10;

  const environmentVariables = Array.from({ length: environmentCount }, (_, index) => ({
    name: `ENV_VAR_${index}`,
    value: `env-value-${index}-${Math.random().toString(36).slice(2, 11)}`
  }));

  const baseStructure: Record<string, unknown> = {
    apiVersion: 'v2',
    name: 'microservice-app',
    description: 'A sample microservice Helm chart',
    version: '1.0.0',
    appVersion: '1.0.0',
    microservice: {
      replicaCount,
      image: {
        repository: 'example.com/my-app',
        tag: 'v1.2.3',
        pullPolicy: 'IfNotPresent'
      },
      service: {
        type: 'ClusterIP',
        port: 8080,
        targetPort: 8080
      },
      resources: {
        limits: {
          cpu: '1000m',
          memory: '512Mi'
        },
        requests: {
          cpu: '100m',
          memory: '128Mi'
        }
      },
      env: environmentVariables
    }
  };

  if (complexity === 'nested' || complexity === 'deep') {
    const nestedDepth = complexity === 'nested' ? 5 : 10;
    baseStructure.nested = generateNestedObject(nestedDepth, 5);
  }

  if (arraySize && arraySize > environmentCount) {
    const additionalItems = Array.from({ length: arraySize - environmentCount }, (_, index) => ({
      name: `EXTRA_VAR_${index}`,
      value: `extra-value-${index}`
    }));
    (baseStructure.microservice as Record<string, unknown>).env = [...environmentVariables, ...additionalItems];
  }

  return YAML.stringify(baseStructure);
};

/**
 * Generate realistic ArgoCD application manifest
 */
const generateArgoCDApp = (options: DataGeneratorOptions): string => {
  const { size, complexity } = options;

  const ignoreDifferencesCount = size === 'small' ? 2 : size === 'medium' ? 5 : size === 'realistic' ? 15 : 10;

  const baseStructure: Record<string, unknown> = {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Application',
    metadata: {
      name: 'my-application',
      namespace: 'argocd',
      finalizers: ['resources-finalizer.argocd.argoproj.io']
    },
    spec: {
      project: 'default',
      source: {
        repoURL: 'https://github.com/example/repo.git',
        targetRevision: 'v1.5.0',
        path: 'helm/charts/my-app',
        helm: {
          valueFiles: ['values.yaml'],
          parameters: [
            { name: 'replicaCount', value: '3' },
            { name: 'image.tag', value: 'v1.2.3' }
          ]
        }
      },
      destination: {
        server: 'https://kubernetes.default.svc',
        namespace: 'production'
      },
      syncPolicy: {
        automated: {
          prune: true,
          selfHeal: true
        },
        syncOptions: ['CreateNamespace=true']
      },
      ignoreDifferences: Array.from({ length: ignoreDifferencesCount }, (_, index) => ({
        group: 'apps',
        kind: 'Deployment',
        jsonPointers: [`/spec/replicas${index}`]
      }))
    }
  };

  if (complexity === 'nested' || complexity === 'deep') {
    const nestedDepth = complexity === 'nested' ? 5 : 10;
    (baseStructure.spec as Record<string, unknown>).customConfig = generateNestedObject(nestedDepth, 3);
  }

  return YAML.stringify(baseStructure);
};

/**
 * Generate realistic Kubernetes Deployment manifest
 */
const generateK8sDeployment = (options: DataGeneratorOptions): string => {
  const { size, complexity } = options;

  const containerCount = size === 'small' ? 1 : size === 'medium' ? 2 : size === 'realistic' ? 3 : 3;
  const environmentVariablesPerContainer =
    size === 'small' ? 5 : size === 'medium' ? 15 : size === 'realistic' ? 80 : 30;

  const containers = Array.from({ length: containerCount }, (_, index) => ({
    name: `container-${index}`,
    image: `example.com/app-${index}:v1.0.0`,
    ports: [{ containerPort: 8080 + index }],
    env: Array.from({ length: environmentVariablesPerContainer }, (_, environmentIndex) => ({
      name: `ENV_${index}_${environmentIndex}`,
      value: `value-${index}-${environmentIndex}`
    })),
    resources: {
      limits: { cpu: '500m', memory: '256Mi' },
      requests: { cpu: '100m', memory: '64Mi' }
    }
  }));

  const baseStructure: Record<string, unknown> = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: 'my-deployment',
      namespace: 'default',
      labels: {
        app: 'my-app',
        version: 'v1'
      }
    },
    spec: {
      replicas: 3,
      selector: {
        matchLabels: {
          app: 'my-app'
        }
      },
      template: {
        metadata: {
          labels: {
            app: 'my-app',
            version: 'v1'
          }
        },
        spec: {
          containers
        }
      }
    }
  };

  if (complexity === 'nested' || complexity === 'deep') {
    const nestedDepth = complexity === 'nested' ? 5 : 10;
    (baseStructure.metadata as Record<string, unknown>).annotations = generateNestedObject(nestedDepth, 3);
  }

  return YAML.stringify(baseStructure);
};

/**
 * Generate realistic YAML content based on options
 * Randomly selects between Helm values, ArgoCD apps, and K8s manifests
 */
export const generateYaml = (options: DataGeneratorOptions): string => {
  const generators = [generateHelmValues, generateArgoCDApp, generateK8sDeployment];
  const randomGenerator = generators[Math.floor(Math.random() * generators.length)];
  return randomGenerator ? randomGenerator(options) : generateHelmValues(options);
};

/**
 * Generate a Map of files with realistic paths and YAML content
 * @param fileCount - Number of files to generate
 * @param options - Data generator options for file content
 * @returns Map of filename to YAML content
 */
export const generateFileMap = (fileCount: number, options: DataGeneratorOptions): Map<string, string> => {
  const fileMap = new Map<string, string>();

  for (let index = 0; index < fileCount; index++) {
    const pathPrefix = ['apps', 'services', 'config', 'manifests'][Math.floor(Math.random() * 4)];
    const subdir = ['frontend', 'backend', 'database', 'cache'][Math.floor(Math.random() * 4)];
    const filename = `file-${index.toString().padStart(4, '0')}.yaml`;
    const path = `${pathPrefix}/${subdir}/${filename}`;

    fileMap.set(path, generateYaml(options));
  }

  return fileMap;
};

/**
 * Generate an array of objects for testing array operations
 */
export const generateObjectArray = (count: number, complexity: 'simple' | 'complex' = 'simple'): unknown[] => {
  if (complexity === 'simple')
    return Array.from({ length: count }, (_, index) => ({
      id: index,
      name: `item-${index}`,
      value: index * 10
    }));

  return Array.from({ length: count }, (_, index) => ({
    id: index,
    metadata: {
      name: `resource-${index}`,
      labels: {
        app: 'test-app',
        version: 'v1',
        env: 'production'
      }
    },
    spec: {
      replicas: 3,
      ports: [80, 443],
      env: [
        { name: 'VAR1', value: 'value1' },
        { name: 'VAR2', value: 'value2' }
      ]
    }
  }));
};
