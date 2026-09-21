export class IncidentNotFoundError extends Error {
  constructor(public readonly incidentId: string) {
    super(`Incident with id "${incidentId}" not found.`);
    this.name = "IncidentNotFoundError";
  }
}

export class RunbookNotFoundError extends Error {
  constructor(public readonly service: string) {
    super(`Runbook para o serviço "${service}" não foi encontrado.`);
    this.name = "RunbookNotFoundError";
  }
}
