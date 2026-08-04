import { Rect } from '../../../common/interfaces/rect.interface';

export interface NoFlyZone extends Rect {
  id: string;
  name: string;
  createdAt: Date;
}
