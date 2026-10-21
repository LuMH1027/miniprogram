import { model } from '../_utils/model';
import { DATA_MODEL_KEY } from '../../config/model';
import { cloudbaseTemplateConfig } from '../../config/index';
import { HOME_SWIPER } from '../cloudbaseMock/index';

const HOME_SWIPER_MODEL_KEY = DATA_MODEL_KEY.HOME_SWIPER;

export async function getHomeSwiper() {
  let swiper;
  if (cloudbaseTemplateConfig.useMock) {
    swiper = HOME_SWIPER[0];
  } else {
    const response = await model()[HOME_SWIPER_MODEL_KEY].list({ select: { images: true } });
    swiper = response?.data?.records?.[0];
  }

  return { ...swiper, images: Array.isArray(swiper?.images) ? swiper.images : [] };
}
