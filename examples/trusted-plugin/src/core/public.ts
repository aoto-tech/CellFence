declare const dbAccess: { select(tableName: string): unknown };

export function readCustomer(): unknown {
  return dbAccess.select("T_CUSTOMER");
}
