# Optimized Strapi Upload Provider For AWS S3

This is a custom ([thebootcode.io](http://thebootcode.io) SEO-Version) Strapi upload provider extension for Amazon S3. It provides additional functionality for processing images, including resizing to various sizes and converting them into multiple formats with format-specific options using [sharp.js](https://sharp.pixelplumbing.com/).

## Features

- **Amazon S3 Integration**: Uploads original and processed images to an S3 bucket.
- **Image Resizing**: Generates multiple sizes (e.g., thumbnail, small, medium, large).
- **Format Conversion**: Converts images to multiple formats (e.g., WebP, AVIF, JPG) with customizable options (e.g., quality).
- **Fully Configurable**: External configuration for formats, sizes, and options.

## Installation

### 1. Install the NPM Package

Install the package directly from NPM:

```bash
npm i strapi-provider-upload-aws-s3-seo
```

### 2. Configure the Plugin

#### a. Configuration
Update your Strapi (>= 4.0.0) `config/plugins.js` file with the following configuration:

```javascript
module.exports = ({ env }) => ({
    upload: {
        config: {
            provider: 'strapi-provider-upload-aws-s3-seo',
            providerOptions: {
                baseUrl: env('CDN_URL'),
                rootPath: env('CDN_ROOT_PATH'),
                s3Options: {
                    credentials: {
                        accessKeyId: env('AWS_ACCESS_KEY_ID'),
                        secretAccessKey: env('AWS_ACCESS_SECRET'),
                    },
                    region: env('AWS_REGION'),
                    params: {
                        ACL: env('AWS_ACL', 'public-read'),
                        signedUrlExpires: env('AWS_SIGNED_URL_EXPIRES', 15 * 60),
                        Bucket: env('AWS_BUCKET'),
                    },
                },
                formats: [
                    { name: 'webp', options: { quality: 80 } }, // WebP with quality 80
                    { name: 'avif', options: { quality: 60 } }, // AVIF with quality 60
                    { name: 'jpg', options: { quality: 90 } },  // JPG with quality 90
                ],
                sizes: [
                    { name: 'thumbnail', width: 96 },
                    { name: 'small', width: 300 },
                    { name: 'medium', width: 960 },
                    { name: 'large', width: 1920 },
                ],
            },
        },
    },
});
```

Find more AWS-specific options [here](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor-property).

#### b. Image Previews 
To allow the thumbnails to properly populate, update also your Strapi (>= 4.0.0) `config/middleware.js` file with the following configuration:

```javascript
module.exports = ({ env }) => [
    // ...
    {
        name: "strapi::security",
        config: {
            contentSecurityPolicy: {
                useDefaults: true,
                directives: {
                    "connect-src": ["'self'", "https:"],
                    "img-src": ["'self'", "data:", "blob:", `${env("CDN_URL")}`],
                    "media-src": ["'self'", "data:", "blob:", `${env("CDN_URL")}`],
                    upgradeInsecureRequests: null,
                },
            },
        },
    },
    // ...
];
```

### 3. Restart Your Strapi Application

Restart your Strapi server to apply the changes:

```bash
npm run develop
```

## Configuration Options

### Formats

The `formats` option is an array of objects. Each object defines:

- **`name`**: The format name (e.g., `webp`, `avif`, `jpg`, `png`).
- **`options`**: Format-specific options (e.g., `quality`, `lossless`).

Example:

```javascript
formats: [
  { name: 'webp', options: { quality: 80 } },
  { name: 'avif', options: { quality: 60 } },
  { name: 'jpg', options: { quality: 90 } },
]
```

Find more Sharp-specific options [here](https://sharp.pixelplumbing.com/api-output#jpeg).

### Sizes

The `sizes` option is an array of objects. Each object defines:

- **`name`**: A unique name for the size (e.g., `thumbnail`, `small`).
- **`width`**: The width of the resized image in pixels.

Example:

```javascript
sizes: [
  { name: 'thumbnail', width: 96 },
  { name: 'small', width: 300 },
  { name: 'medium', width: 960 },
  { name: 'large', width: 1920 },
]
```

## Behavior

When an image is uploaded:

1. **Original File**: The original file is uploaded to S3.
2. **Processing**: Each format and size combination is processed (e.g., resized and converted).
3. **Upload Variants**: Processed files are uploaded to S3 with a naming convention: `<imageName>_<sizeName>.<format>`.
4. **Metadata**: URLs for all variants are stored in Strapi under `file.formats`.

## Example

### Configuration Example

Given the following configuration:

```javascript
formats: [
  { name: 'webp', options: { quality: 80 } },
  { name: 'jpg', options: { quality: 90 } }
],
sizes: [
  { name: 'thumbnail', width: 96 },
  { name: 'medium', width: 960 }
]
```

### Resulting Files

For an image `image123.png`, the following files will be uploaded to S3:

```
image123_thumbnail.webp
image123_thumbnail.jpg
image123_medium.webp
image123_medium.jpg
...
image123.png (original)
```

## Deleting Files

When a file is deleted via Strapi, all its variants (original, resized, converted) are deleted from S3.

## Troubleshooting

- Ensure that your AWS credentials and bucket permissions are correctly configured.
- Check for errors in the Strapi logs for debugging issues with image processing or uploads.

## License

This project is licensed under the ISC License.