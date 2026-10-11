// Novedades de cada versión: se muestran una vez, la primera vez que se abre la versión nueva.
// Están en changelog.json para que el script de publicación use las mismas notas en GitHub.
import changelog from './changelog.json'

export const CHANGELOG: Record<string, string[]> = changelog
