#!/usr/bin/env sh
# Deploys PeerLearn to the current Kubernetes cluster (Docker Desktop, minikube or kind).
# Run from the repository root after: cp .env.example .env  and  ./infra/gen-certs.sh
set -e
NS=peerlearn

kubectl apply -f k8s/namespace.yaml

# Secrets come from local files, never from the repository (SO-1).
kubectl -n "$NS" create secret generic peerlearn-secrets --from-env-file=.env \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "$NS" create secret tls web-tls --cert=infra/certs/server.crt --key=infra/certs/server.key \
  --dry-run=client -o yaml | kubectl apply -f -

# A finished Job cannot be updated, so remove the old migration before applying again.
kubectl -n "$NS" delete job migrate --ignore-not-found

kubectl apply -k k8s

kubectl -n "$NS" rollout status deployment/db --timeout=180s
kubectl -n "$NS" wait --for=condition=complete job/migrate --timeout=300s
kubectl -n "$NS" rollout restart deployment/api
kubectl -n "$NS" rollout status deployment/api --timeout=180s
kubectl -n "$NS" rollout status deployment/web --timeout=180s

kubectl -n "$NS" get pods,services
echo "PeerLearn is running. On Docker Desktop open https://localhost ; elsewhere run:"
echo "  kubectl -n $NS port-forward service/web 8443:443   and open https://localhost:8443"
