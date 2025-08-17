const items = require('./fakeDB');
const db = require('./fakeDB');
const express = require('express');

const app = express();
const port = process.env.port || 3000;

const normalizeKeys = (obj) => {
    return Object.fromEntries(
        Object.entries(obj).map(([key, val]) => [key.toLowerCase(), val.toLowerCase()])
    )
}

const generateExpressError = (errorMessage, status = 500) => {
    return {
        status,
        error: new Error(errorMessage)
    }
}

const dupCheck = new Set();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/items', (rq, rs, next) => {
    rs.status(200).json(db)
})

app.post('/items', (rq, rs, next) => {
    let items = rq.body;
    const result = [];
    const errors = [];
    if(!Array.isArray(items)) { 
        items = [items]
    }
    for (item of items) {
        const { name, price } = normalizeKeys(item);
        if (!name || !price) { 
            errors.push({...item, error: "Name or price not specified."});
        } else if (dupCheck.has(name)) {
            errors.push({...item, error: "Duplicate item."});
        } else {
            result.push({ name, price });
            dupCheck.add(name);
            db.push({ name, price });
        }
    }
    if (!result) {
        return rs.status(400).json({ errors })
    }
    return rs.status(200).json({ added: result, errors })
})

app.get('/items/:name', (rq, rs, next) => {
    const { name } = rq.params;
    for (idx in db) {
        if (name.toLowerCase() === db[idx].name) {
            return rs.status(200).json(db[idx]);
        }
    }
    return next(generateExpressError("Item not found.", 404));
})

app.patch('/items/:name', (rq, rs, next) => {
    const toPatch = rq.params.name;
    if (Array.isArray(rq.body)) {
        return next(generateExpressError("Json array was provided where object is expected.", 400));
    }
    const { name, price } = normalizeKeys(rq.body);
    if (!name || !price) {
        return next(generateExpressError("Name or price not specified.", 400));
    }
    if (name !== toPatch.toLowerCase() && dupCheck.has(name)) {
        return next(generateExpressError("Updated name is a duplicate.", 400))
    }
    for (idx in db) {
        if (toPatch.toLowerCase() === db[idx].name) {
            let prev = db[idx];
            db[idx] = { name, price };
            dupCheck.delete(prev.name);
            dupCheck.add(name);
            return rs.status(200).json({ prev, updated: db[idx] });
        }
    }
    return next(generateExpressError("Item not found.", 404));
})

app.delete('/items/:name', (rq, rs, next) => {
    const toDelete = rq.params.name;
    for (idx in db) {
        if (toDelete.toLowerCase() === db[idx].name) {
            const [deleted] = db.splice(idx, 1);
            dupCheck.delete(deleted.name);
            return rs.status(200).json({ deleted });
        }
    }    
    return next(generateExpressError("Item not found.", 404));
})

app.use((e, rq, rs, next) => {
    const { status, error } = e;
    console.error(error.stack);
    rs.status(status).json({ error: error.message });
})

app.listen(port, err => {
    if (err) throw new Error(err)
})