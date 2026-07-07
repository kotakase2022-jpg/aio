import { readFileSync } from "node:fs";
import ts from "typescript";

export function extractQualityCheckIds(path: string) {
  const sourceText = readFileSync(path, "utf8");
  const sourceFile = ts.createSourceFile(path, sourceText, ts.ScriptTarget.Latest, true);
  const ids: string[] = [];

  function visit(node: ts.Node) {
    if (ts.isObjectLiteralExpression(node) && isQualityCheckObject(node)) {
      const id = readStringProperty(node, "id");
      if (id) {
        ids.push(id);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return ids;
}

function isQualityCheckObject(node: ts.ObjectLiteralExpression) {
  const propertyNames = new Set(
    node.properties
      .filter(ts.isPropertyAssignment)
      .map((property) => readPropertyName(property.name))
      .filter((name): name is string => Boolean(name)),
  );

  return (
    propertyNames.has("id") &&
    propertyNames.has("label") &&
    propertyNames.has("passed") &&
    propertyNames.has("detail")
  );
}

function readStringProperty(node: ts.ObjectLiteralExpression, name: string) {
  const property = node.properties.find(
    (item): item is ts.PropertyAssignment =>
      ts.isPropertyAssignment(item) && readPropertyName(item.name) === name,
  );

  if (!property || !ts.isStringLiteral(property.initializer)) {
    return "";
  }

  return property.initializer.text;
}

function readPropertyName(name: ts.PropertyName) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return "";
}
