"""Run locally in Codespaces on your own trusted trained model; no upload or pickle loading."""
import json
from pathlib import Path


def export_linear_model(model, features, destination, *, title_ar, title_en, task='regression'):
    """Export fitted single-output LinearRegression or multiclass LogisticRegression.

    Inputs must be the same transformed numeric features used in training.
    Binary logistic regression is represented as logits [0, z].
    No preprocessing pipelines, SVMs, tree models or neural networks are converted.
    """
    from sklearn.linear_model import LinearRegression, LogisticRegression
    import numpy as np

    if task == 'regression' and isinstance(model, LinearRegression):
        if np.asarray(model.coef_).ndim != 1:
            raise ValueError('Single-output regression only')
        weights = [model.coef_.tolist()]
        bias = [float(model.intercept_)]
        labels = ['prediction']
    elif task == 'classification' and isinstance(model, LogisticRegression):
        labels = [str(x) for x in model.classes_]
        weights = model.coef_.tolist()
        bias = model.intercept_.tolist()
        if len(labels) == 2 and len(weights) == 1:
            weights = [[0.0] * len(features), weights[0]]
            bias = [0.0, bias[0]]
        elif len(labels) > 2:
            # Softmax matches multinomial models, not one-vs-rest logistic regression.
            if model.solver == 'liblinear' or getattr(model, 'multi_class', None) == 'ovr':
                raise ValueError('Multinomial logistic regression only')
    else:
        raise ValueError('Only fitted LinearRegression and LogisticRegression are supported')
    if not 1 <= len(features) <= 32 or len(set(features)) != len(features) or len(labels) > 32:
        raise ValueError('Use 1–32 unique features and at most 32 labels')
    if any(len(w) != len(features) for w in weights):
        raise ValueError('Feature count mismatch')
    spec = {'mode': 'numeric', 'title_ar': title_ar, 'title_en': title_en,
            'model': {'task': task, 'features': list(features), 'labels': labels,
                      'weights': weights, 'bias': bias}}
    Path(destination).write_text(json.dumps(spec, ensure_ascii=False, allow_nan=False, indent=2), encoding='utf-8')
    return spec


def export_table(source, destination, *, sheet=0, table=None):
    """Convert trusted data exports privately to UTF-8 CSV. Never runs a project script or SQL query supplied as code."""
    import pandas as pd
    suffix = Path(source).suffix.lower()
    if suffix in ('.xlsx', '.xlsm', '.ods'):
        import zipfile
        with zipfile.ZipFile(source) as z:
            if len(z.infolist()) > 5000 or sum(x.file_size for x in z.infolist()) > 50 * 1024 * 1024:
                raise ValueError('Spreadsheet expands beyond 50 MB')
        df = pd.read_excel(source, sheet_name=sheet)
    elif suffix == '.xls':
        df = pd.read_excel(source, sheet_name=sheet)
    elif suffix == '.parquet':
        df = pd.read_parquet(source)
    elif suffix == '.json':
        df = pd.read_json(source)
    elif suffix in ('.csv', '.tsv'):
        df = pd.read_csv(source, sep='\t' if suffix == '.tsv' else ',')
    elif suffix in ('.db', '.sqlite', '.sqlite3'):
        import sqlite3
        with sqlite3.connect(Path(source).resolve().as_uri() + '?mode=ro', uri=True) as conn:
            names = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if table not in names:
                raise ValueError('Select an existing table: ' + ', '.join(sorted(names)))
            df = pd.read_sql_query('SELECT * FROM "' + table.replace('"', '""') + '"', conn)
    else:
        raise ValueError('Export your data as Excel, CSV, TSV, flat JSON, Parquet or SQLite')
    if len(df)>10000 or len(df.columns)>80:
        raise ValueError('Select up to 10,000 rows and 80 columns for this experience')
    df.to_csv(destination, index=False, encoding='utf-8-sig')
    return {'rows': len(df), 'columns': list(df.columns)}


def export_plotly(figure, destination):
    """Standalone Plotly HTML with bundled JS, no CDN. Review embedded data before publication."""
    figure.write_html(str(destination), include_plotlyjs=True, full_html=True, auto_open=False)


def describe_onnx(source, destination, *, title_ar, title_en, shapes=None):
    """Create a studio specification for an existing self-contained ONNX model.
    Supply fixed shapes for dynamic dimensions. Input values need the training preprocessing.
    """
    import base64
    import onnx
    model = onnx.load(str(source), load_external_data=False)
    if any(x.data_location == onnx.TensorProto.EXTERNAL for x in model.graph.initializer):
        raise ValueError('Use a self-contained ONNX model')
    t = {onnx.TensorProto.FLOAT:'float32', onnx.TensorProto.DOUBLE:'float64',
         onnx.TensorProto.INT32:'int32', onnx.TensorProto.INT64:'int64',
         onnx.TensorProto.UINT8:'uint8', onnx.TensorProto.BOOL:'bool'}
    initializers = {x.name for x in model.graph.initializer}
    inputs = []
    for x in model.graph.input:
        if x.name in initializers:
            continue
        if not x.type.HasField('tensor_type') or x.type.tensor_type.elem_type not in t:
            raise ValueError('Unsupported input tensor type: ' + x.name)
        tt = x.type.tensor_type
        shape = (shapes or {}).get(x.name, [d.dim_value for d in tt.shape.dim])
        if any(not isinstance(n, int) or n < 1 for n in shape):
            raise ValueError('Provide fixed input dimensions for ' + x.name)
        inputs.append({'name':x.name,'type':t[tt.elem_type],'shape':shape})
    data = Path(source).read_bytes()
    if len(data) > 5 * 1024 * 1024:
        raise ValueError('Use a compressed/smaller model or a linked public demo')
    result = {'mode':'onnx','title_ar':title_ar,'title_en':title_en,
              'onnx':{'data':base64.b64encode(data).decode('ascii'),'inputs':inputs}}
    Path(destination).write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
    return result


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Private studio data conversion')
    parser.add_argument('source')
    parser.add_argument('destination')
    parser.add_argument('--sheet', default='0')
    parser.add_argument('--table')
    args = parser.parse_args()
    sheet = int(args.sheet) if args.sheet.isdecimal() else args.sheet
    print(export_table(args.source, args.destination, sheet=sheet, table=args.table))
